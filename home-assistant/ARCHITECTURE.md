# Home Assistant Integration Architecture

This document describes how to connect a Flame Boss controller to
[Home Assistant](https://www.home-assistant.io/) (or any MQTT client) in a way
that survives Flame Boss's **multi-server** MQTT topology, and how to
auto-create Home Assistant entities with **MQTT discovery**.

It is aimed at developers building an integration or add-on. End users who just
want temperatures on a dashboard should follow
[setup.md](setup.md) instead.

---

## Background: the multi-server problem

The simplest way to get Flame Boss data into Home Assistant is a static
**Mosquitto bridge** — a config file that points the Home Assistant broker at a
single Flame Boss MQTT server. This works today and is documented as the manual
path in the setup guide.

It has one fundamental limitation: **a bridge's server address is fixed.** As
Flame Boss scales to multiple MQTT servers, a device is no longer pinned to one
server — it may connect to any server, and it may move between them. A static
bridge cannot follow that. It cannot:

- discover which server a device is currently on,
- reconnect and re-subscribe when the device moves,
- serve a user whose devices are spread across several servers at once.

Making the bridge "smart" fights the tool — a bridge has no logic. The right
shape is a small **relay client** that holds the routing logic while a normal
broker moves the bytes.

---

## The MQTT connection protocol

### Brokers

| Environment | Directory broker |
| --- | --- |
| Production | `myflameboss.com:1883` |
| Test | `fb.oak.flameboss.com:1883` |

The **directory broker** is an entry point that resolves to *any* Flame Boss
server. A client connects there to discover where each of its devices lives.

### Discovering devices and their servers

Authenticate to the directory broker with the user's MQTT credentials (the
`T-<user_id>` username and token from the Developer page), then:

1. **Announce** — publish to `user/<user_id>/send`:

   ```json
   { "name": "connected" }
   ```

2. **Receive a `connected` message per online device** on
   `user/<user_id>/recv`:

   ```json
   { "name": "connected", "device_id": 123456, "server": "s7.myflameboss.com" }
   ```

   The `server` field is the FQDN of the specific server that device is
   **currently** connected to.

### No polling required

Any time a device connects, **every** server emits the `connected` message for
it. So after the initial announce, the client simply keeps its directory
connection open and reacts to `connected` messages as they arrive. A device that
**migrates** to another server reconnects there and re-announces with the new
`server` value — which is the client's signal to re-route. There is no need to
poll a status endpoint.

### Device data topics

Once the client knows a device is on `server`, it opens an MQTT connection to
that server and uses:

| Topic | Direction | Purpose |
| --- | --- | --- |
| `flameboss/<device_id>/send/#` | device → client | Telemetry. The `send/open` message (`name:"temps"`) carries live probe data. |
| `flameboss/<device_id>/recv` | client → device | Commands (e.g. set target temperature). |

---

## The relay design

The recommended client is a **multiplexing relay**: a plain MQTT client on both
sides that maintains connections to each Flame Boss server a device is on and
relays messages to/from the Home Assistant broker. No second broker, no bridge
config, no restarts to reconfigure.

```
         directory broker                 Flame Boss servers
      (myflameboss.com:1883)          ┌─ s7.myflameboss.com ─┐
              │  user/<id>/*          │   flameboss/A/#       │
              ▼                       │   flameboss/B/#       │
        ┌───────────┐  control plane  └──────────┬───────────┘
        │           │◄──────────────────────────┘  (one conn per SERVER)
        │   RELAY   │  data plane
        │           │──────────────► core-mosquitto (Home Assistant broker)
        └───────────┘                 flameboss/<id>/send/#  (retained)
                                       flameboss/<id>/recv    (commands)
```

Design principles:

- **Control plane / data plane split.** The directory connection (`user/<id>/*`)
  is the control plane — it decides *which server* each device is on. Per-server
  connections are the data plane — they move telemetry and commands.
- **Connections keyed by server, not device.** Two devices on the same server
  share one upstream connection. A migration moves a device between connections
  and reaps any connection left with no devices.
- **Directional routing prevents loops.** Telemetry flows device → HA on
  `send/#`; commands flow HA → device on `recv`. The two directions never share a
  topic pattern, so nothing a relay publishes gets re-consumed and relayed again.
- **Retain asymmetry.** Telemetry is published to Home Assistant with
  `retain=true` so entities repopulate instantly after a Home Assistant restart.
  Commands are published to devices with `retain=false` so a stale command can
  never replay.

### Skeleton

`aiomqtt`-style pseudocode. `Upstream` is one connection per server; `Relay`
multiplexes N servers onto the single Home Assistant broker.

```python
DIRECTORY = "myflameboss.com"        # test: "fb.oak.flameboss.com"
USER_ID   = 42
HA_BROKER = "core-mosquitto"
HA_USER, HA_PASS   = "relay", "..."
FB_USER, FB_TOKEN  = "T-42", "..."   # upstream creds (same as the apps)

def send_filter(dev): return f"flameboss/{dev}/send/#"    # device → HA
def recv_topic(dev):  return f"flameboss/{dev}/recv"      # HA → device


class Upstream:
    """One connection to one Flame Boss server; serves all this user's
    devices that are currently on that server."""
    def __init__(self, host, relay):
        self.host, self.relay, self.devices, self.client = host, relay, set(), None

    async def run(self):
        while not self.relay.closing:
            try:
                async with aiomqtt.Client(self.host, 1883,
                                          username=FB_USER, password=FB_TOKEN) as c:
                    self.client = c
                    for dev in list(self.devices):
                        await c.subscribe(send_filter(dev))
                    async for msg in c.messages:            # DEVICE → HA, retained
                        await self.relay.ha.publish(msg.topic, msg.payload, retain=True)
            except MqttError:
                await asyncio.sleep(2)                      # auto-reconnect

    async def add(self, dev):
        self.devices.add(dev)
        if self.client: await self.client.subscribe(send_filter(dev))

    async def remove(self, dev):
        self.devices.discard(dev)
        if self.client: await self.client.unsubscribe(send_filter(dev))


class Relay:
    def __init__(self):
        self.shards, self.device_shard, self.announced = {}, {}, set()
        self.ha, self.closing = None, False

    async def run(self):
        async with aiomqtt.Client(HA_BROKER, 1883, username=HA_USER, password=HA_PASS) as ha:
            self.ha = ha
            await asyncio.gather(self.control_channel(), self.ha_command_pump(ha))

    async def control_channel(self):
        """Directory broker: discover devices + their servers, react to changes."""
        while not self.closing:
            try:
                async with aiomqtt.Client(DIRECTORY, 1883,
                                          username=FB_USER, password=FB_TOKEN) as entry:
                    await entry.subscribe(f"user/{USER_ID}/recv")
                    await entry.publish(f"user/{USER_ID}/send",
                                        json.dumps({"name": "connected"}))   # prime
                    async for msg in entry.messages:
                        d = json.loads(msg.payload)
                        if d.get("name") == "connected":
                            await self.on_connected(d["device_id"], d["server"])
            except MqttError:
                await asyncio.sleep(2)                       # reconnect re-primes

    async def on_connected(self, dev, server):
        if dev not in self.announced:                        # publish discovery once
            for s in SENSORS:
                topic, payload = discovery(dev, s)
                await self.ha.publish(topic, payload, retain=True)
            await self.ha.subscribe(recv_topic(dev))
            self.announced.add(dev)
        await self.assign(dev, server)                       # route / migrate

    async def assign(self, dev, server):
        old = self.device_shard.get(dev)
        if old == server:
            return
        if old and old in self.shards:
            await self.shards[old].remove(dev)
            await self.gc(old)
        if server not in self.shards:
            up = Upstream(server, self)
            self.shards[server] = up
            asyncio.create_task(up.run())
        await self.shards[server].add(dev)
        self.device_shard[dev] = server

    async def gc(self, server):
        up = self.shards.get(server)
        if up and not up.devices:
            up.client and await up.client.disconnect()
            del self.shards[server]

    async def ha_command_pump(self, ha):
        async for msg in ha.messages:                        # HA → device
            up = self.shards.get(self.device_shard.get(parse_device(msg.topic)))
            if up and up.client:
                await up.client.publish(msg.topic, msg.payload, retain=False)
```

---

## Home Assistant MQTT auto-discovery

Rather than have users hand-write sensor YAML, the relay publishes **retained
discovery configs** so Home Assistant creates the entities automatically. The
config topic is:

```
homeassistant/sensor/flameboss_<device_id>/<key>/config
```

Each payload groups its entity under one Home Assistant **device** (via
`device.identifiers`) so all of a controller's sensors appear together as
"Flame Boss `<device_id>`".

### Entity spec

Fahrenheit shown; for Celsius use `value_json.<field> / 10` and unit `°C`.

| key | Name | Unit | value_template (Jinja) | Availability |
| --- | --- | --- | --- | --- |
| `pit` | Pit Temp | °F | `(temps[0]\|float * 9/50 + 32)\|round(0)` | probe 0 ≠ −32767 |
| `probe1` | Meat Probe 1 | °F | `(temps[1]\|float * 9/50 + 32)\|round(0)` | probe 1 ≠ −32767 |
| `probe2` | Meat Probe 2 | °F | `(temps[2]\|float * 9/50 + 32)\|round(0)` | probe 2 ≠ −32767 |
| `probe3` | Meat Probe 3 | °F | `(temps[3]\|float * 9/50 + 32)\|round(0)` | probe 3 ≠ −32767 |
| `set` | Pit Set Temp | °F | `(set_temp\|float * 9/50 + 32)\|round(0)` | — |
| `fan` | Fan Speed | % | `(blower\|float / 100)\|round(0)` | — |

### Discovery builder

```python
EXPIRE_AFTER = 180     # entity → unavailable if the device stops publishing

SENSORS = [
    {"key":"pit",    "name":"Pit Temp",     "unit":"°F","dc":"temperature","field":"temps[0]",  "probe":0},
    {"key":"probe1", "name":"Meat Probe 1", "unit":"°F","dc":"temperature","field":"temps[1]",  "probe":1},
    {"key":"probe2", "name":"Meat Probe 2", "unit":"°F","dc":"temperature","field":"temps[2]",  "probe":2},
    {"key":"probe3", "name":"Meat Probe 3", "unit":"°F","dc":"temperature","field":"temps[3]",  "probe":3},
    {"key":"set",    "name":"Pit Set Temp", "unit":"°F","dc":"temperature","field":"set_temp",  "probe":None, "icon":"mdi:thermometer"},
    {"key":"fan",    "name":"Fan Speed",    "unit":"%", "dc":None,         "field":"blower",    "probe":None, "fan":True},
]

def value_template(s):
    if s.get("fan"):
        return "{{ (value_json.blower|float / 100)|round(0) }}"
    return "{{ (value_json.%s|float * 9/50 + 32)|round(0) }}" % s["field"]   # °F

def discovery(dev, s):
    state = f"flameboss/{dev}/send/open"          # the name:"temps" message
    cfg = {
        "name": s["name"],
        "unique_id": f"flameboss_{dev}_{s['key']}",
        "state_topic": state,
        "value_template": value_template(s),
        "force_update": True,
        "expire_after": EXPIRE_AFTER,
        "device": {
            "identifiers": [f"flameboss_{dev}"],
            "name": f"Flame Boss {dev}",
            "manufacturer": "Flame Boss",
        },
    }
    if s["unit"]: cfg["unit_of_measurement"] = s["unit"]
    if s["dc"]:   cfg["device_class"] = s["dc"]
    if s.get("icon"): cfg["icon"] = s["icon"]
    if s["probe"] is not None:                    # hide an unplugged probe
        cfg["availability"] = [{
            "topic": state,
            "value_template":
                f"{{{{ 'online' if value_json.temps[{s['probe']}]|int != -32767 else 'offline' }}}}",
        }]
    return f"homeassistant/sensor/flameboss_{dev}/{s['key']}/config", json.dumps(cfg)
```

### Liveness — two mechanisms, both from signals we already have

- **`expire_after`** — if the device stops publishing (cook ended, powered off),
  Home Assistant marks all its entities unavailable after the timeout. This
  substitutes for an explicit "device offline" message.
- **Per-probe `availability`** — an unplugged probe reports `-32767`; the
  template hides just that probe while the device is otherwise live.

### Removing a device

To delete a controller's entities (device removed from the account), publish an
**empty** retained payload to each of its
`homeassistant/sensor/flameboss_<device_id>/<key>/config` topics. This requires a
"removed" signal or reconciliation against the account's device list.

---

## Message & unit reference

Live telemetry arrives on `flameboss/<device_id>/send/open`:

```json
{
  "name": "temps",
  "cook_id": 1380,
  "sec": 1784920711,
  "temps": [260, -32767, -32767, -32767],
  "set_temp": 1072,
  "blower": 10000
}
```

| Field | Meaning | °F | °C |
| --- | --- | --- | --- |
| `temps[0]` | Pit temperature | `x * 9/50 + 32` | `x / 10` |
| `temps[1..3]` | Meat probes 1–3 | `x * 9/50 + 32` | `x / 10` |
| `set_temp` | Target pit temperature | `x * 9/50 + 32` | `x / 10` |
| `blower` | Fan output, 0–10000 | percent = `blower / 100` | — |

- Temperatures are in **decidegrees Celsius** (`1072` → 107.2 °C → 225 °F).
- **`-32767` means the probe is not connected.**
- Commands to `flameboss/<device_id>/recv` use the same decidegree scale, e.g.
  `{"name":"set_temp","value":1350}` sets 135.0 °C (275 °F).

---

## Deployment

The relay is just an MQTT client, so it can run anywhere with network access to
both the Flame Boss servers and the Home Assistant broker. The tidiest packaging
for end users is a **Home Assistant add-on** (a container configured from the HA
UI), which lets it reach `core-mosquitto` directly and take credentials through
the add-on options. The same code can later be wrapped in a HACS config flow to
become a first-class integration — the relay is its data plane; only the
sign-in UI is added.

## See also

- [setup.md](setup.md) — end-user setup, including
  the manual Mosquitto bridge fallback.
