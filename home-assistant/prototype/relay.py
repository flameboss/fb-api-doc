#!/usr/bin/env python3
"""
Flame Boss → Home Assistant relay (standalone prototype).

A multiplexing MQTT relay that:

  1. connects to the Flame Boss *directory* broker and announces the user,
  2. learns each device's current server from `connected` messages,
  3. opens one upstream connection per server and relays telemetry into the
     Home Assistant broker (retained),
  4. publishes Home Assistant MQTT *discovery* configs so entities auto-create,
  5. relays commands from Home Assistant back to the device,
  6. follows devices as they migrate between servers — no restart, no polling.

This is a prototype: single user, in-memory state, minimal error handling.
It is meant to prove the protocol end-to-end. See ../ARCHITECTURE.md.

Run it against the local simulator (see README.md):

    python relay.py --directory localhost --ha-host localhost \
        --user-id 42 --fb-user test --fb-token test

Dependencies: aiomqtt>=2.0  (pip install -r requirements.txt)
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging
import os
import signal

import aiomqtt

log = logging.getLogger("relay")

# Directory brokers by environment. `--directory` overrides for local testing.
DIRECTORY_BROKERS = {
    "prod": "myflameboss.com",
    "test": "fb.oak.flameboss.com",
}

EXPIRE_AFTER = 180  # seconds; entity → unavailable if the device stops publishing


# ─── topic helpers ──────────────────────────────────────────────────────────
def send_filter(dev: int) -> str:
    return f"flameboss/{dev}/send/#"      # device → HA


def state_topic(dev: int) -> str:
    return f"flameboss/{dev}/send/open"   # the name:"temps" message


def recv_topic(dev: int) -> str:
    return f"flameboss/{dev}/recv"        # HA → device


def device_from_topic(topic: str) -> int | None:
    parts = topic.split("/")
    if len(parts) >= 2 and parts[0] == "flameboss" and parts[1].isdigit():
        return int(parts[1])
    return None


# ─── entity spec + discovery config ─────────────────────────────────────────
# probe = temps[] index that must be present (≠ -32767) for availability;
#         None means an always-present field (set_temp, blower).
SENSORS = [
    {"key": "pit",    "name": "Pit Temp",     "unit": "temp", "dc": "temperature", "field": "temps[0]", "probe": 0},
    {"key": "probe1", "name": "Meat Probe 1", "unit": "temp", "dc": "temperature", "field": "temps[1]", "probe": 1},
    {"key": "probe2", "name": "Meat Probe 2", "unit": "temp", "dc": "temperature", "field": "temps[2]", "probe": 2},
    {"key": "probe3", "name": "Meat Probe 3", "unit": "temp", "dc": "temperature", "field": "temps[3]", "probe": 3},
    {"key": "set",    "name": "Pit Set Temp", "unit": "temp", "dc": "temperature", "field": "set_temp", "probe": None, "icon": "mdi:thermometer"},
    {"key": "fan",    "name": "Fan Speed",    "unit": "%",    "dc": None,          "field": "blower",   "probe": None, "fan": True},
]


def temp_expr(field: str, units: str) -> str:
    # Flame Boss temps are decidegrees Celsius.
    if units == "c":
        return f"(value_json.{field}|float / 10)|round(0)"
    return f"(value_json.{field}|float * 9/50 + 32)|round(0)"


def discovery(dev: int, s: dict, units: str) -> tuple[str, str]:
    state = state_topic(dev)
    if s.get("fan"):
        value_template = "{{ (value_json.blower|float / 100)|round(0) }}"
    else:
        value_template = "{{ " + temp_expr(s["field"], units) + " }}"

    cfg = {
        "name": s["name"],
        "unique_id": f"flameboss_{dev}_{s['key']}",
        "state_topic": state,
        "value_template": value_template,
        "force_update": True,
        "expire_after": EXPIRE_AFTER,
        "device": {
            "identifiers": [f"flameboss_{dev}"],
            "name": f"Flame Boss {dev}",
            "manufacturer": "Flame Boss",
        },
    }
    if s["unit"] == "temp":
        cfg["unit_of_measurement"] = "°C" if units == "c" else "°F"
    elif s["unit"]:
        cfg["unit_of_measurement"] = s["unit"]
    if s["dc"]:
        cfg["device_class"] = s["dc"]
    if s.get("icon"):
        cfg["icon"] = s["icon"]
    if s["probe"] is not None:
        cfg["availability"] = [{
            "topic": state,
            "value_template":
                f"{{{{ 'online' if value_json.temps[{s['probe']}]|int != -32767 "
                f"else 'offline' }}}}",
        }]

    topic = f"homeassistant/sensor/flameboss_{dev}/{s['key']}/config"
    return topic, json.dumps(cfg)


# ─── one connection per Flame Boss server ───────────────────────────────────
class Upstream:
    def __init__(self, host: str, relay: "Relay"):
        self.host = host
        self.relay = relay
        self.devices: set[int] = set()
        self.client: aiomqtt.Client | None = None
        self.task: asyncio.Task | None = None

    async def run(self) -> None:
        while not self.relay.closing:
            try:
                async with aiomqtt.Client(
                    self.host, self.relay.args.port,
                    username=self.relay.args.fb_user or None,
                    password=self.relay.args.fb_token or None,
                ) as c:
                    self.client = c
                    log.info("upstream connected: %s (devices=%s)", self.host, sorted(self.devices))
                    for dev in list(self.devices):
                        await c.subscribe(send_filter(dev))
                    async for msg in c.messages:
                        # DEVICE → HA, retained so entities survive HA restarts.
                        await self.relay.ha.publish(msg.topic.value, msg.payload, retain=True)
            except asyncio.CancelledError:
                log.info("upstream closed: %s", self.host)
                raise
            except aiomqtt.MqttError as e:
                self.client = None
                log.warning("upstream %s error: %s — reconnecting", self.host, e)
                await asyncio.sleep(2)

    async def add(self, dev: int) -> None:
        self.devices.add(dev)
        if self.client:
            await self.client.subscribe(send_filter(dev))

    async def remove(self, dev: int) -> None:
        self.devices.discard(dev)
        if self.client:
            await self.client.unsubscribe(send_filter(dev))


# ─── the relay ──────────────────────────────────────────────────────────────
class Relay:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.shards: dict[str, Upstream] = {}   # server host -> Upstream
        self.device_shard: dict[int, str] = {}  # device_id   -> server host
        self.announced: set[int] = set()
        self.ha: aiomqtt.Client | None = None
        self.closing = False

    async def run(self) -> None:
        async with aiomqtt.Client(
            self.args.ha_host, self.args.ha_port,
            username=self.args.ha_user or None,
            password=self.args.ha_pass or None,
        ) as ha:
            self.ha = ha
            log.info("connected to HA broker %s:%d", self.args.ha_host, self.args.ha_port)
            await asyncio.gather(self.control_channel(), self.ha_command_pump())

    # control plane: directory broker, user/<id>/* ------------------------
    async def control_channel(self) -> None:
        uid = self.args.user_id
        while not self.closing:
            try:
                async with aiomqtt.Client(
                    self.args.directory, self.args.port,
                    username=self.args.fb_user or None,
                    password=self.args.fb_token or None,
                ) as entry:
                    await entry.subscribe(f"user/{uid}/recv")
                    await entry.publish(f"user/{uid}/send", json.dumps({"name": "connected"}))
                    log.info("directory connected: %s — announced user %s", self.args.directory, uid)
                    async for msg in entry.messages:
                        try:
                            d = json.loads(msg.payload)
                        except (ValueError, TypeError):
                            continue
                        if d.get("name") == "connected" and "device_id" in d and "server" in d:
                            await self.on_connected(int(d["device_id"]), str(d["server"]))
            except aiomqtt.MqttError as e:
                log.warning("directory error: %s — reconnecting", e)
                await asyncio.sleep(2)

    async def on_connected(self, dev: int, server: str) -> None:
        if not self.allowed_server(server):
            log.warning("ignoring device %s: server %r not allowed", dev, server)
            return
        if dev not in self.announced:
            log.info("discovering device %s", dev)
            for s in SENSORS:
                topic, payload = discovery(dev, s, self.args.units)
                await self.ha.publish(topic, payload, retain=True)
            await self.ha.subscribe(recv_topic(dev))
            self.announced.add(dev)
        await self.assign(dev, server)

    def allowed_server(self, server: str) -> bool:
        # Guard against a spoofed `connected` pointing us at an arbitrary host.
        if not self.args.allow_servers:
            return True
        return any(server == a or server.endswith("." + a) for a in self.args.allow_servers)

    # routing: keyed by server, not device -------------------------------
    async def assign(self, dev: int, server: str) -> None:
        old = self.device_shard.get(dev)
        if old == server:
            return
        if old is not None:
            log.info("device %s migrating: %s → %s", dev, old, server)
            if old in self.shards:
                await self.shards[old].remove(dev)
                await self.gc(old)
        if server not in self.shards:
            up = Upstream(server, self)
            up.task = asyncio.create_task(up.run())
            self.shards[server] = up
        await self.shards[server].add(dev)
        self.device_shard[dev] = server

    async def gc(self, server: str) -> None:
        up = self.shards.get(server)
        if up and not up.devices:
            log.info("closing idle upstream %s", server)
            if up.task:
                up.task.cancel()
            del self.shards[server]

    # HA → device --------------------------------------------------------
    async def ha_command_pump(self) -> None:
        async for msg in self.ha.messages:
            dev = device_from_topic(msg.topic.value)
            if dev is None:
                continue
            up = self.shards.get(self.device_shard.get(dev, ""))
            if up and up.client:
                await up.client.publish(msg.topic.value, msg.payload, retain=False)
                log.info("relayed command → device %s: %s", dev, msg.payload)


# ─── entrypoint ─────────────────────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Flame Boss → Home Assistant relay (prototype)")
    env = os.environ.get
    p.add_argument("--env", choices=["prod", "test"], default=env("FB_RELAY_ENV", "test"),
                   help="selects the default directory broker (default: test)")
    p.add_argument("--directory", default=env("FB_RELAY_DIRECTORY"),
                   help="override directory broker host (e.g. localhost for the simulator)")
    p.add_argument("--port", type=int, default=int(env("FB_RELAY_PORT", "1883")))
    p.add_argument("--user-id", type=int, default=int(env("FB_RELAY_USER_ID", "0")), required=not env("FB_RELAY_USER_ID"))
    p.add_argument("--fb-user", default=env("FB_RELAY_FB_USER", ""))
    p.add_argument("--fb-token", default=env("FB_RELAY_FB_TOKEN", ""))
    p.add_argument("--ha-host", default=env("FB_RELAY_HA_HOST", "core-mosquitto"))
    p.add_argument("--ha-port", type=int, default=int(env("FB_RELAY_HA_PORT", "1883")))
    p.add_argument("--ha-user", default=env("FB_RELAY_HA_USER", ""))
    p.add_argument("--ha-pass", default=env("FB_RELAY_HA_PASS", ""))
    p.add_argument("--units", choices=["f", "c"], default=env("FB_RELAY_UNITS", "f"))
    p.add_argument("--allow-servers", nargs="*", default=_split(env("FB_RELAY_ALLOW_SERVERS", "")),
                   help="allowlist of server suffixes, e.g. flameboss.com (empty = allow any)")
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args()
    if not args.directory:
        args.directory = DIRECTORY_BROKERS[args.env]
    return args


def _split(s: str) -> list[str]:
    return [x for x in s.replace(",", " ").split() if x]


async def main() -> None:
    args = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )
    relay = Relay(args)

    stop = asyncio.Event()
    loop = asyncio.get_running_loop()
    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, stop.set)
        except NotImplementedError:  # e.g. Windows
            pass

    runner = asyncio.create_task(relay.run())
    await asyncio.wait({runner, asyncio.create_task(stop.wait())},
                       return_when=asyncio.FIRST_COMPLETED)
    relay.closing = True
    runner.cancel()
    try:
        await runner
    except (asyncio.CancelledError, aiomqtt.MqttError):
        pass
    log.info("relay stopped")


if __name__ == "__main__":
    asyncio.run(main())
