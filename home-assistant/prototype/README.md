# Relay prototype

A standalone, runnable proof of the design in [../ARCHITECTURE.md](../ARCHITECTURE.md).
It relays Flame Boss telemetry into a Home Assistant (MQTT) broker, auto-creates
entities via MQTT discovery, and follows a device as it migrates between servers.

- **`relay.py`** — the relay itself (the future add-on's core).
- **`sim_harness.py`** — a fake Flame Boss server so you can run the whole thing
  locally with no real device or credentials.

> Prototype status: single user, in-memory state, minimal error handling. The
> goal is to validate the protocol end-to-end before packaging it as a Home
> Assistant add-on.

## Try it locally

Use **two** local Mosquitto brokers — one for "Home Assistant", one for the
Flame Boss cloud. This mirrors production (they are always different brokers) and
avoids a command-echo loop you'd get by sharing one. With Mosquitto installed:

```bash
# terminal 1 — the "Home Assistant" broker (core-mosquitto)
mosquitto -v -c /dev/stdin <<'EOF'
listener 1883
allow_anonymous true
EOF

# terminal 2 — the Flame Boss directory + servers
mosquitto -v -c /dev/stdin <<'EOF'
listener 1884
allow_anonymous true
EOF
```

Then, in separate terminals:

```bash
# 3. dependencies
pip install -r requirements.txt

# 4. fake Flame Boss server on the FB broker (directory + server + telemetry)
python sim_harness.py --broker localhost --port 1884 --user-id 42 --device-id 123456

# 5. the relay: directory/servers on the FB broker (1884), telemetry out to HA (1883)
python relay.py --directory localhost --port 1884 \
    --ha-host localhost --ha-port 1883 \
    --user-id 42 --fb-user test --fb-token test -v

# 6. watch what lands on the "Home Assistant" broker
mosquitto_sub -h localhost -p 1883 -v -t 'homeassistant/#' -t 'flameboss/#'
```

### What you should see

- **Terminal 6** immediately shows six retained `homeassistant/sensor/flameboss_123456/*/config`
  discovery messages, then a stream of `flameboss/123456/send/open` telemetry.
- **Terminal 5** (relay) logs `discovering device 123456`, then after ~20s
  `device 123456 migrating: localhost → 127.0.0.1` and `closing idle upstream
  localhost` — the re-route happens with **no restart**, and telemetry keeps
  flowing.
- Test the command path by publishing to the **HA** broker:

  ```bash
  mosquitto_pub -h localhost -p 1883 -t flameboss/123456/recv -m '{"name":"set_temp","value":1350}'
  ```

  The relay logs `relayed command → device 123456` **once**, and the simulator
  (terminal 4) prints `COMMAND received by device: …`.

> The two "servers" (`localhost` / `127.0.0.1`) are the FB broker under two
> names — enough to exercise the relay's re-route logic. A real migration
> crosses different physical servers; the relay code path is identical.
>
> **Why two brokers:** the relay both subscribes to `flameboss/<id>/recv` on the
> HA broker (to catch commands) and publishes to `flameboss/<id>/recv` on the FB
> broker (to send them). If those were the same broker, the relay would receive
> its own command back and loop. In production the HA broker (`core-mosquitto`)
> and the Flame Boss servers are always distinct, so this cannot happen.

## Point it at the real test server

With a real controller online and MQTT credentials from your Developer page:

```bash
python relay.py --env test --ha-host localhost \
    --user-id <your_user_id> --fb-user T-<id> --fb-token <token> \
    --allow-servers flameboss.com -v
```

`--allow-servers flameboss.com` restricts which `server` values the relay will
connect to, so a spoofed `connected` message can't redirect it to an arbitrary
host. Drop it (empty) only for local testing.

## Configuration

Every flag has an `FB_RELAY_*` environment-variable equivalent (see
`relay.py --help`), which is how the eventual add-on will pass options.

| Flag | Env | Default | Notes |
| --- | --- | --- | --- |
| `--env` | `FB_RELAY_ENV` | `test` | `prod`→`myflameboss.com`, `test`→`fb.oak.flameboss.com` |
| `--directory` | `FB_RELAY_DIRECTORY` | — | overrides `--env` (use `localhost` for the sim) |
| `--user-id` | `FB_RELAY_USER_ID` | — | required |
| `--fb-user` / `--fb-token` | `FB_RELAY_FB_USER` / `_FB_TOKEN` | — | Flame Boss MQTT creds |
| `--ha-host` / `--ha-port` | `FB_RELAY_HA_HOST` / `_HA_PORT` | `core-mosquitto` / `1883` | HA broker |
| `--ha-user` / `--ha-pass` | `FB_RELAY_HA_USER` / `_HA_PASS` | — | HA broker login |
| `--units` | `FB_RELAY_UNITS` | `f` | `f` or `c` |
| `--allow-servers` | `FB_RELAY_ALLOW_SERVERS` | (any) | server-suffix allowlist |
