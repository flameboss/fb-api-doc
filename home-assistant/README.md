# Flame Boss + Home Assistant

- **[setup.md](setup.md)** — connect a Flame Boss controller to Home Assistant.
  Start here. Covers the recommended add-on and the manual MQTT-bridge fallback.
- **[ARCHITECTURE.md](ARCHITECTURE.md)** — for developers: the multi-server MQTT
  protocol, the multiplexing relay design, and Home Assistant MQTT
  auto-discovery.
- **[prototype/](prototype/)** — a runnable relay + a fake-server test harness
  that proves the design locally (no controller or credentials needed).
- **[addon/](addon/)** — Home Assistant add-on packaging for the relay
  (reference; move to a dedicated add-on repository to distribute).
- **[addon-repo/](addon-repo/)** — scaffold for the distribution repo
  (`repository.yaml`, README, and the multi-arch build workflow).
