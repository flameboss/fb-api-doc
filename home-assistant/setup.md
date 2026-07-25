# Connect Your Flame Boss to Home Assistant

This guide walks you through monitoring (and optionally controlling) your Flame
Boss controller from [Home Assistant](https://www.home-assistant.io/) over MQTT.
When you're done you'll have live pit and meat‑probe temperatures, your target
temperature, and fan output as Home Assistant sensors you can put on a
dashboard, chart, or use in automations.

## Two ways to connect

| | **Flame Boss add-on** (recommended) | **Manual MQTT bridge** |
| --- | --- | --- |
| Setup | Install, enter your login, done | Edit config files by hand |
| Entities | Created automatically | You write sensor YAML |
| Multiple servers | Handled automatically | Points at one server only |
| Availability | In your Add-on Store, if published for your account | Works on any Home Assistant today |

> **Which should I use?** If the **Flame Boss** add-on appears in your Home
> Assistant Add-on Store, use it (Option A) — it auto-creates your entities and
> keeps working even as Flame Boss adds servers. If it isn't available yet, the
> manual bridge (Option B) works today on any Home Assistant. For how the add-on
> works under the hood, see [ARCHITECTURE.md](ARCHITECTURE.md).

---

## Option A — Flame Boss add-on (recommended)

1. Settings → Add-ons → **Add-on Store**, and install the **Flame Boss** add-on.
2. Open its **Configuration** tab and enter your Flame Boss **user id**
   (`fb_user_id`) and **MQTT token** (`fb_token`) — get them from your Developer
   page (Step 1 below explains where). Leave `fb_cloud` at `myflameboss.com`.
3. **Start** the add-on.

That's it. Your controllers appear automatically under
**Settings → Devices & Services → MQTT** as a device named **"Flame Boss
`<your device id>`"**, with pit, meat‑probe, set‑temp and fan sensors already
created. Skip straight to [See your data](#see-your-data) — you can
ignore the manual bridge and sensor YAML entirely.

The add-on connects the way the Flame Boss mobile apps do: it finds whichever
server each of your controllers is currently on and follows it if it moves, so
there is nothing to reconfigure as Flame Boss scales. Details in
[ARCHITECTURE.md](ARCHITECTURE.md).

---

## Option B — Manual MQTT bridge

If the add-on isn't available to you, you can bridge the Mosquitto broker that
runs inside Home Assistant to the Flame Boss cloud MQTT server yourself.

> **Heads up — single server.** A manual bridge points at **one** Flame Boss
> server (`myflameboss.com`). This works today, but as Flame Boss moves to
> multiple servers a controller may be assigned to a different server, and a
> static bridge cannot follow it. If your data stops arriving after previously
> working, switch to the add-on (Option A). Background:
> [ARCHITECTURE.md](ARCHITECTURE.md).

## What you'll need

- A running Home Assistant installation (Home Assistant OS on a Green/Yellow/Pi,
  or a supervised install — anything that can install **add-ons**).
- The **Mosquitto broker** add-on installed and running
  (Settings → Add-ons → Add-on Store → *Mosquitto broker*).
- A way to edit files: the **File editor** or **Studio Code Server** add-on, or
  the **Samba share** / **SSH** add-on. Files live under `/share/` and
  `/config/`.
- Your Flame Boss **Device ID** and **MQTT credentials** (next section).

> This guide assumes your Flame Boss is already set up and reporting to the
> Flame Boss cloud (you can see it in the Flame Boss app). The bridge reads the
> same cloud data — it does not talk to the controller directly.

---

## Step 1 — Get your credentials

You need three things from your Flame Boss account:

| Item | Where to find it |
| --- | --- |
| **Device ID** | Flame Boss app → your controller. A 6‑digit number, e.g. `123456`. |
| **MQTT username** | Developer page, looks like `T-237883`. |
| **MQTT password** | Developer page (an API token). |

Open your **Developer page** while signed in:

```
https://myflameboss.com/en/users/dev
```

Copy the **username** (`T-…`) and **password** shown there. Treat the password
like any other secret.

Throughout this guide, replace:

- `123456` with your **Device ID**
- `T-237883` with your **MQTT username**
- `YOUR_MQTT_PASSWORD` with your **MQTT password**

---

## Step 2 — Configure the MQTT bridge

The Mosquitto add-on can load extra configuration files from a folder you
control. First enable that, then drop in a bridge config.

### 2a. Enable custom config in the Mosquitto add-on

Settings → Add-ons → **Mosquitto broker** → **Configuration** tab. Make sure the
`customize` block is set like this:

```yaml
customize:
  active: true
  folder: mosquitto
```

This tells Mosquitto to load every `*.conf` file it finds in
**`/share/mosquitto/`**.

### 2b. Create the bridge file

Create the folder `/share/mosquitto/` if it doesn't exist, and add a file named
**`flameboss.conf`** with this content:

```conf
connection flameboss
address myflameboss.com:1883

# A UNIQUE client id is REQUIRED — see the warning below.
remote_clientid flameboss-T-237883

remote_username T-237883
remote_password YOUR_MQTT_PASSWORD

bridge_protocol_version mqttv311
cleansession true
start_type automatic
notifications false

# Bring your controller's published data INTO Home Assistant. Subscribe to the
# explicit subtopics, not a send/# wildcard (the server may ignore a wildcard):
topic flameboss/123456/send/open in 0
topic flameboss/123456/send/data in 0

# OPTIONAL — allow Home Assistant to send commands to the controller:
topic flameboss/123456/recv out 0
```

> ### ⚠️ You must set a unique `remote_clientid`
> If you leave `remote_clientid` out, the Flame Boss server will **refuse the
> connection** (the bridge connects for a second, then drops, repeatedly).
> Tying the id to your `T-…` username, as above, guarantees it's unique.
>
> **Why:** the Mosquitto add-on otherwise derives a client id from its container
> hostname (`core-mosquitto`), which is identical for every Home Assistant user.
> MQTT requires client ids to be globally unique, so the Flame Boss server
> rejects any connection whose id starts with `core-mosquitto`.

### 2c. Restart and verify

Restart the **Mosquitto broker** add-on, then open its **Log** tab. A healthy
bridge shows a line like:

```
Connecting bridge flameboss (myflameboss.com:1883)
```

with no repeating connection/authentication errors. If you see the bridge
connect and immediately drop over and over, re‑check your `remote_clientid`
(see the warning above) and your username/password.

---

## Step 3 — Add the sensors

Now turn the incoming MQTT messages into Home Assistant sensors.

Edit **`/config/configuration.yaml`** and add the block below. If you already
have an `mqtt:` section, add these entries under its existing `sensor:` list
instead of creating a second `mqtt:` key (YAML allows each top‑level key only
once).

```yaml
mqtt:
  sensor:
    - name: "Pit Temp"
      state_topic: "flameboss/123456/send/open"
      unit_of_measurement: "°F"
      device_class: "temperature"
      force_update: true
      value_template: "{{ (value_json.temps[0]|float * 9/50 + 32)|round(0) }}"
      availability:
        - topic: "flameboss/123456/send/open"
          value_template: "{{ 'online' if value_json.temps[0]|int != -32767 else 'offline' }}"

    - name: "Meat Probe 1"
      state_topic: "flameboss/123456/send/open"
      unit_of_measurement: "°F"
      device_class: "temperature"
      force_update: true
      value_template: "{{ (value_json.temps[1]|float * 9/50 + 32)|round(0) }}"
      availability:
        - topic: "flameboss/123456/send/open"
          value_template: "{{ 'online' if value_json.temps[1]|int != -32767 else 'offline' }}"

    - name: "Meat Probe 2"
      state_topic: "flameboss/123456/send/open"
      unit_of_measurement: "°F"
      device_class: "temperature"
      force_update: true
      value_template: "{{ (value_json.temps[2]|float * 9/50 + 32)|round(0) }}"
      availability:
        - topic: "flameboss/123456/send/open"
          value_template: "{{ 'online' if value_json.temps[2]|int != -32767 else 'offline' }}"

    - name: "Meat Probe 3"
      state_topic: "flameboss/123456/send/open"
      unit_of_measurement: "°F"
      device_class: "temperature"
      force_update: true
      value_template: "{{ (value_json.temps[3]|float * 9/50 + 32)|round(0) }}"
      availability:
        - topic: "flameboss/123456/send/open"
          value_template: "{{ 'online' if value_json.temps[3]|int != -32767 else 'offline' }}"

    - name: "Pit Set Temp"
      state_topic: "flameboss/123456/send/open"
      unit_of_measurement: "°F"
      device_class: "temperature"
      force_update: true
      icon: mdi:thermometer
      value_template: "{{ (value_json.set_temp|float * 9/50 + 32)|round(0) }}"

    - name: "Fan Speed"
      state_topic: "flameboss/123456/send/open"
      unit_of_measurement: "%"
      force_update: true
      value_template: "{{ (value_json.blower|float / 100)|round(0) }}"
```

### Prefer Celsius?

Replace each temperature `value_template` with the Celsius form (divide by 10,
no offset). For example, Pit Temp becomes:

```yaml
      value_template: "{{ (value_json.temps[0]|float / 10)|round(0) }}"
      unit_of_measurement: "°C"
```

### Apply it

1. **Developer Tools → YAML → Check Configuration** and confirm it says *valid*.
2. **Settings → System → Restart Home Assistant** (a full restart; the quick
   "reload" is not always enough the first time you add these).

---

## See your data

- **Entities:** Settings → Devices & Services → **Entities** → search "Pit".
  Your Pit / probe / set-temp / fan sensors should appear. Note the entity IDs
  differ by path: the **add-on (Option A)** prefixes them with the device name
  (`sensor.flame_boss_120504_pit_temp`), while **manual sensors (Option B)** use
  the name you gave (`sensor.pit_temp`). Use the exact IDs shown here when
  building dashboards or automations.
- **Live values:** Fire up the smoker (or make sure it's cooking) so it's
  publishing. Pit Temp will track your fire and Pit Set Temp will show your
  target.
- **Unplugged probes read "Unavailable" — that's expected.** A disconnected
  probe reports `-32767`, and the `availability` template hides it until you
  plug one in, at which point it comes online automatically.

### Put them on a dashboard

Edit your dashboard (**⋮ → Edit Dashboard → + Add Card**) and add an
**Entities**, **Gauge**, or **History graph** card pointing at the new
`sensor.*` entities. A single history‑graph card with pit + set temp + meat
probes makes a great at‑a‑glance cook view.

---

## Message & unit reference

Your controller publishes a JSON message to
`flameboss/<DEVICE_ID>/send/open` that looks like:

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

| Field | Meaning | Convert to °F | Convert to °C |
| --- | --- | --- | --- |
| `temps[0]` | Pit temperature | `x * 9/50 + 32` | `x / 10` |
| `temps[1..3]` | Meat probes 1–3 | `x * 9/50 + 32` | `x / 10` |
| `set_temp` | Target pit temperature | `x * 9/50 + 32` | `x / 10` |
| `blower` | Fan output, 0–10000 | — | — (percent = `blower / 100`) |

Notes:

- Temperatures are in **decidegrees Celsius**. Example: `260` → 26.0 °C → 79 °F;
  `1072` → 107.2 °C → 225 °F.
- **`-32767` means a probe is not connected.**
- `blower` ranges 0–10000, so `10000` = 100%.

---

## Optional — control your smoker from Home Assistant

If you included the `topic flameboss/123456/recv out 0` line in your bridge, you
can send commands from Home Assistant. For example, to change the target pit
temperature, publish to the `recv` topic (value is in decidegrees Celsius —
`1350` = 135.0 °C = 275 °F):

**Developer Tools → Actions** → `mqtt.publish`:

```yaml
topic: flameboss/123456/recv
payload: '{"name":"set_temp","value":1350}'
```

---

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| `ssh: connect ... port 22: Connection refused` when reaching HA | Not related to Flame Boss — the SSH add-on isn't running or its port isn't mapped. Enable the port in the SSH add-on's **Network** section. |
| Bridge connects then drops repeatedly; log shows `takenover` | Missing/duplicate `remote_clientid`. Set a unique one (see the warning under Step 2b). |
| Bridge won't authenticate | Wrong `remote_username`/`remote_password`. Re‑copy them from the Developer page. |
| Sensors never appear | The `mqtt:` block failed to load — run **Check Configuration**, fix the reported error, then do a **full restart** (not just reload). |
| A live probe shows "Unavailable" | Make sure the sensor's `state_topic` and `availability` `topic` both point at **`send/open`** (the message whose `name` is `temps`), not a wildcard — other messages can carry a `-32767` and flip it offline. |
| Everything is "Unavailable" right after a restart | Normal. Flame Boss messages aren't retained, so sensors stay Unavailable until the next live message arrives. |
| Values are wildly wrong (e.g. −3276.7) | A disconnected probe (`-32767`) is being shown as a temperature. Confirm the `availability` template is present for that sensor. |
| Data stopped arriving after working for a while | Your controller may have moved to a different Flame Boss server, which a manual bridge can't follow. Use the add-on (Option A) — [why](ARCHITECTURE.md#background-the-multi-server-problem). |

---

## See also

- [ARCHITECTURE.md](ARCHITECTURE.md) — how the add-on works, the multi-server
  MQTT protocol, and the relay + auto-discovery design (for developers).

