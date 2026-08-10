#!/usr/bin/env python3
"""
Flame Boss → Home Assistant relay (standalone prototype).

A multiplexing MQTT relay that:

  1. connects to the Flame Boss *directory* broker and announces the user,
  2. learns each device's current server from `connected` messages,
  3. relays telemetry from each server into the Home Assistant broker (retained),
  4. publishes Home Assistant MQTT *discovery* configs so entities auto-create,
  5. relays commands from Home Assistant back to the device,
  6. follows devices as they migrate between servers — no restart, no polling.

Connection model
----------------
When the relay announces on the directory broker, the server replies with:

  * a device-less `connected` naming the server THIS connection landed on
    (the directory hostname is an entry point / load balancer, so the relay is
    told the canonical server FQDN it is actually connected to), and
  * one `connected` per online device, each naming that device's server.

A device whose server matches a connection the relay already holds (including
the directory connection itself) is served on that existing connection — the
relay only opens a new connection for a server it isn't connected to yet.

This is a prototype: single user, in-memory state, minimal error handling.
See ../ARCHITECTURE.md.

    python relay.py --fb-cloud localhost --ha-host localhost \
        --fb-user-id 42 --fb-token test

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


def _short(payload, limit: int = 200) -> str:
    """Compact a payload for trace logging."""
    if payload is None:
        return ""
    s = payload.decode(errors="replace") if isinstance(payload, (bytes, bytearray)) else str(payload)
    return s if len(s) <= limit else s[:limit - 3] + "..."


EXPIRE_AFTER = 180  # seconds; entity → unavailable if the device stops publishing


# ─── topic helpers ──────────────────────────────────────────────────────────
# Subscribe to explicit subtopics rather than a `send/#` wildcard — the server
# ACL may silently ignore a wildcard subscription.
SEND_SUBTOPICS = ("open", "data")


def send_topics(dev: int) -> list[str]:
    return [f"flameboss/{dev}/send/{sub}" for sub in SEND_SUBTOPICS]  # device → HA


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


# ─── one connection to one Flame Boss server ────────────────────────────────
class ServerConn:
    """A connection to a Flame Boss server.

    The `entry` connection is dialed to the directory host; it announces the
    user and carries the `user/<id>/*` control channel. It ALSO relays
    telemetry for any devices that live on the server it landed on. Non-entry
    connections are pure data connections dialed straight to a server FQDN.
    """

    def __init__(self, relay: "Relay", dial_host: str, is_entry: bool = False):
        self.relay = relay
        self.dial_host = dial_host
        self.is_entry = is_entry
        self.fqdn = dial_host           # canonical name; for entry, learned below
        self.devices: set[int] = set()
        self.client: aiomqtt.Client | None = None
        self.task: asyncio.Task | None = None

    @property
    def label(self) -> str:
        return f"[{self.fqdn}]"

    async def run(self) -> None:
        uid = self.relay.args.fb_user_id
        while not self.relay.closing:
            try:
                async with aiomqtt.Client(
                    self.dial_host, self.relay.args.port,
                    username=self.relay.args.fb_user or None,
                    password=self.relay.args.fb_token or None,
                ) as c:
                    self.client = c
                    if self.is_entry:
                        await c.subscribe(f"user/{uid}/recv")
                        log.debug("SUB   %s user/%s/recv", self.label, uid)
                        announce = json.dumps({"name": "connected"})
                        await c.publish(f"user/{uid}/send", announce)
                        log.debug("PUB   %s user/%s/send %s", self.label, uid, announce)
                        log.info("directory connected: %s — announced user %s", self.dial_host, uid)
                    else:
                        log.info("connected to server %s (devices=%s)", self.fqdn, sorted(self.devices))
                    for dev in list(self.devices):
                        for t in send_topics(dev):
                            await c.subscribe(t)
                            log.debug("SUB   %s %s", self.label, t)
                    async for msg in c.messages:
                        topic = msg.topic.value
                        log.debug("RECV  %s %s %s", self.label, topic, _short(msg.payload))
                        if topic.startswith("user/"):
                            await self.relay.handle_control(msg, self)
                        else:
                            # DEVICE → HA, retained so entities survive HA restarts.
                            await self.relay.ha.publish(topic, msg.payload, retain=True)
                            log.debug("PUB   [HA] %s (retain) %s", topic, _short(msg.payload))
            except asyncio.CancelledError:
                log.info("closed connection to %s", self.fqdn)
                raise
            except aiomqtt.MqttError as e:
                self.client = None
                log.warning("connection %s error: %s — reconnecting", self.fqdn, e)
                await asyncio.sleep(2)

    async def add(self, dev: int) -> None:
        self.devices.add(dev)
        if self.client:
            for t in send_topics(dev):
                await self.client.subscribe(t)
                log.debug("SUB   %s %s", self.label, t)

    async def remove(self, dev: int) -> None:
        self.devices.discard(dev)
        if self.client:
            for t in send_topics(dev):
                await self.client.unsubscribe(t)
                log.debug("UNSUB %s %s", self.label, t)


# ─── the relay ──────────────────────────────────────────────────────────────
class Relay:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.shards: dict[str, ServerConn] = {}   # server FQDN -> connection
        self.device_shard: dict[int, str] = {}    # device_id   -> server FQDN
        self.announced: set[int] = set()
        self.entry: ServerConn | None = None
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
            self.entry = ServerConn(self, self.args.fb_cloud, is_entry=True)
            await asyncio.gather(self.entry.run(), self.ha_command_pump())

    # control plane: user/<id>/recv messages -----------------------------
    async def handle_control(self, msg, conn: ServerConn) -> None:
        try:
            d = json.loads(msg.payload)
        except (ValueError, TypeError):
            return
        if d.get("name") != "connected" or "server" not in d:
            return
        server = str(d["server"])
        if "device_id" not in d:
            # Device-less `connected`: the server THIS connection landed on.
            if conn.fqdn != server:
                log.info("directory connection is on server %s", server)
            conn.fqdn = server
            self.shards[server] = conn      # so devices on this server reuse it
            return
        await self.on_device(int(d["device_id"]), server)

    async def on_device(self, dev: int, server: str) -> None:
        if not self.allowed_server(server):
            log.warning("ignoring device %s: server %r not allowed", dev, server)
            return
        if dev not in self.announced:
            log.info("discovering device %s", dev)
            for s in SENSORS:
                topic, payload = discovery(dev, s, self.args.units)
                await self.ha.publish(topic, payload, retain=True)
                log.debug("PUB   [HA] %s (retain, discovery)", topic)
            await self.ha.subscribe(recv_topic(dev))
            log.debug("SUB   [HA] %s", recv_topic(dev))
            self.announced.add(dev)
        await self.assign(dev, server)

    def allowed_server(self, server: str) -> bool:
        # Anti-spoof: only connect to fb_cloud or a subdomain of it (device
        # servers are subdomains, e.g. s1.myflameboss.com). Skipped for a
        # bare hostname or IP (local/dev, e.g. the simulator).
        cloud = self.args.fb_cloud
        if "." not in cloud or cloud.replace(".", "").isdigit():
            return True
        return server == cloud or server.endswith("." + cloud)

    # routing: reuse a connection we already hold for `server` -----------
    async def assign(self, dev: int, server: str) -> None:
        old = self.device_shard.get(dev)
        if old == server:
            return
        if old is not None:
            log.info("device %s migrating: %s → %s", dev, old, server)
            if old in self.shards:
                await self.shards[old].remove(dev)
                await self.gc(old)
        conn = self.shards.get(server)
        if conn is None:
            # A server we're not connected to yet — dial it. (If a device
            # arrives before the directory's device-less `connected`, we may
            # briefly open a 2nd connection to the directory's own server;
            # harmless, and it collapses once that message registers the entry.)
            log.info("opening connection to %s for device %s", server, dev)
            conn = ServerConn(self, server)
            conn.task = asyncio.create_task(conn.run())
            self.shards[server] = conn
        else:
            log.info("device %s served by existing connection %s", dev, server)
        await conn.add(dev)
        self.device_shard[dev] = server

    async def gc(self, server: str) -> None:
        conn = self.shards.get(server)
        if conn and not conn.devices and not conn.is_entry:   # never close the entry
            log.info("closing idle connection %s", server)
            if conn.task:
                conn.task.cancel()
            del self.shards[server]

    # HA → device --------------------------------------------------------
    async def ha_command_pump(self) -> None:
        async for msg in self.ha.messages:
            topic = msg.topic.value
            log.debug("RECV  [HA] %s %s", topic, _short(msg.payload))
            dev = device_from_topic(topic)
            if dev is None:
                continue
            conn = self.shards.get(self.device_shard.get(dev, ""))
            if conn and conn.client:
                await conn.client.publish(topic, msg.payload, retain=False)
                log.info("relayed command → device %s: %s", dev, _short(msg.payload))
                log.debug("PUB   %s %s %s", conn.label, topic, _short(msg.payload))


# ─── entrypoint ─────────────────────────────────────────────────────────────
def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Flame Boss → Home Assistant relay (prototype)")
    env = os.environ.get
    p.add_argument("--fb-cloud", default=env("FB_RELAY_FB_CLOUD", "myflameboss.com"),
                   help="Flame Boss cloud host to announce on (default: myflameboss.com; "
                        "localhost for the simulator). Also "
                        "bounds which servers the relay will connect to (it + subdomains).")
    p.add_argument("--port", type=int, default=int(env("FB_RELAY_PORT", "1883")))
    p.add_argument("--fb-user-id", type=int, default=int(env("FB_RELAY_FB_USER_ID", "0")),
                   required=not env("FB_RELAY_FB_USER_ID"),
                   help="your Flame Boss numeric user id (MQTT username is T-<id>)")
    p.add_argument("--fb-token", default=env("FB_RELAY_FB_TOKEN", ""))
    p.add_argument("--ha-host", default=env("FB_RELAY_HA_HOST", "core-mosquitto"))
    p.add_argument("--ha-port", type=int, default=int(env("FB_RELAY_HA_PORT", "1883")))
    p.add_argument("--ha-user", default=env("FB_RELAY_HA_USER", ""))
    p.add_argument("--ha-pass", default=env("FB_RELAY_HA_PASS", ""))
    p.add_argument("--units", choices=["f", "c"], default=env("FB_RELAY_UNITS", "f"))
    p.add_argument("-v", "--verbose", action="store_true")
    args = p.parse_args()
    args.fb_user = f"T-{args.fb_user_id}"      # MQTT username is a function of the user id
    return args


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
