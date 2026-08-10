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

### Broker

myflameboss.com:1883

This **directory broker** is an entry point that resolves to *any* Flame Boss
server. A client connects there to discover where each of its devices lives.

### Discovering devices and their servers

Authenticate to the directory broker with the user's MQTT credentials (the
`T-<user_id>` username and token from the Developer page), then:

1. **Announce** — publish to `user/<user_id>/send`:

   ```json
   { "name": "connected" }
   ```

2. **Receive a device-less `connected`** naming the server THIS connection
   landed on:

   ```json
   { "name": "connected", "server": "s1.myflameboss.com" }
   ```

   The directory host is an entry point that resolves to one of the servers;
   this message tells the client the canonical FQDN it is actually connected to.

3. **Receive a `connected` per online device**, each naming that device's
   server:

   ```json
   { "name": "connected", "device_id": 123456, "server": "s1.myflameboss.com" }
   ```

   The `server` field is the FQDN of the specific server that device is
   **currently** connected to.

### Reusing the connection you're already on

Because the device-less `connected` (step 2) tells the client which server its
directory connection is on, a device whose `server` equals that FQDN is served
**on the existing connection** — the client does not dial a second connection to
a server it is already connected to. It opens a new connection only for a server
it isn't connected to yet. So the directory connection is not purely
control-plane; it also carries telemetry for the devices that live on the server
it landed on.

### No polling required

Any time a device connects, **every** server emits the `connected` message for
it. So after the initial announce, the client keeps its directory connection
open and reacts to `connected` messages as they arrive. A device that
**migrates** to another server re-announces with the new `server` value — the
client's signal to move it onto (or open) that server's connection. There is no
status endpoint to poll.

### Device data topics

| Topic | Direction | Purpose |
| --- | --- | --- |
| `flameboss/<device_id>/send/open` | device → client | Live telemetry (`name:"temps"`) — probe temps, set temp, blower. |
| `flameboss/<device_id>/send/data` | device → client | Additional device data messages. |
| `flameboss/<device_id>/recv` | client → device | Commands (e.g. set target temperature). |

Subscribe to these **explicit** subtopics, not a `send/#` wildcard — the server
ACL may silently ignore a wildcard subscription (no error, no messages).

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

- **The directory connection doubles as a data connection.** It carries the
  `user/<id>/*` control channel (deciding which server each device is on) *and*
  relays telemetry for any devices on the server it landed on. Additional
  connections are opened only for other servers.
- **Connections keyed by server, not device.** Devices on the same server share
  one connection; a device is reused onto an existing connection when its server
  matches one already held. A migration moves a device between connections and
  reaps any non-directory connection left with no devices (the directory
  connection is never closed — it's the control channel).
- **Directional routing prevents loops.** Telemetry flows device → HA on
  `send/#`; commands flow HA → device on `recv`. The two directions never share a
  topic pattern, so nothing a relay publishes gets re-consumed and relayed again.
- **Retain asymmetry.** Telemetry is published to Home Assistant with
  `retain=true` so entities repopulate instantly after a Home Assistant restart.
  Commands are published to devices with `retain=false` so a stale command can
  never replay.

### Implementation

A complete, runnable implementation is in
[prototype/relay.py](prototype/relay.py), verified end-to-end against the test
server (discovery, telemetry, connection reuse, live migration, commands). Its
shape:

- **`ServerConn`** — one connection to one Flame Boss server. The *entry*
  connection is dialed to the directory host, announces the user, and carries
  `user/<id>/recv`. Every `ServerConn` relays `flameboss/<dev>/send/#` for its
  devices to the HA broker (retained).
- **`Relay.handle_control`** — on a **device-less** `connected`, records the
  server the entry connection is on, so devices there reuse it; on a **device**
  `connected`, publishes discovery once and routes the device.
- **`Relay.assign`** — reuses an existing connection when the device's server
  matches one already held, else opens a new `ServerConn`; on migration, moves
  the device and reaps the old connection (never the entry).
- **`Relay.ha_command_pump`** — relays `flameboss/<dev>/recv` from Home
  Assistant to the device's current server connection (never retained).

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

> **Entity IDs are prefixed with the device name.** Recent Home Assistant
> derives the entity ID from the device name plus the entity name, so "Pit Temp"
> on device "Flame Boss 120504" becomes `sensor.flame_boss_120504_pit_temp`
> (not `sensor.pit_temp`). Use the actual IDs from Settings → Entities when
> wiring dashboards or automations.

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
