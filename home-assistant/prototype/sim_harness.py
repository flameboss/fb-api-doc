#!/usr/bin/env python3
"""
Fake Flame Boss server — test harness for relay.py.

Runs against a local Mosquitto and plays the role of the Flame Boss directory
broker AND the device's server, so you can exercise the whole relay without a
real controller or credentials. It:

  1. answers the relay's announce (`user/<id>/send` {name:connected}) with a
     `connected` message per fake device on `user/<id>/recv`,
  2. streams realistic telemetry to `flameboss/<device_id>/send/open`,
  3. after --migrate-after seconds, re-announces the device on a different
     `server` value to exercise the relay's no-restart re-route,
  4. prints any command the relay relays to `flameboss/<device_id>/recv`.

Because everything points at one local broker, the two "servers" are just two
host spellings of that broker (localhost / 127.0.0.1); the relay treats them as
distinct servers and re-routes, which is what we're testing.

    python sim_harness.py --broker localhost --user-id 42 --device-id 123456

Dependencies: aiomqtt>=2.0
"""
from __future__ import annotations

import argparse
import asyncio
import json
import logging

import aiomqtt

log = logging.getLogger("sim")


class Sim:
    def __init__(self, args: argparse.Namespace):
        self.args = args
        self.server = args.servers[0]     # current "server" the device reports on
        self.tick = 0

    async def run(self) -> None:
        async with aiomqtt.Client(self.args.broker, self.args.port) as c:
            self.client = c
            await c.subscribe(f"user/{self.args.user_id}/send")   # relay announces here
            await c.subscribe(f"flameboss/{self.args.device_id}/recv")  # commands land here
            log.info("simulator up on %s — user=%s device=%s server=%s",
                     self.args.broker, self.args.user_id, self.args.device_id, self.server)
            await asyncio.gather(self.telemetry_loop(), self.control_loop(), self.migrate_later())

    # respond to announces + print relayed commands ----------------------
    async def control_loop(self) -> None:
        async for msg in self.client.messages:
            topic = msg.topic.value
            if topic == f"user/{self.args.user_id}/send":
                try:
                    d = json.loads(msg.payload)
                except (ValueError, TypeError):
                    continue
                if d.get("name") == "connected":
                    log.info("relay announced — replying with device %s on %s",
                             self.args.device_id, self.server)
                    await self.announce_device()
            elif topic == f"flameboss/{self.args.device_id}/recv":
                log.info("COMMAND received by device: %s", msg.payload.decode(errors="replace"))

    async def announce_device(self) -> None:
        await self.client.publish(
            f"user/{self.args.user_id}/recv",
            json.dumps({"name": "connected",
                        "device_id": self.args.device_id,
                        "server": self.server}),
        )

    # stream telemetry ---------------------------------------------------
    async def telemetry_loop(self) -> None:
        # Pit warms from ~24°C toward the 107.2°C set point; probe 1 plugged in,
        # probes 2 & 3 disconnected (-32767). Values are decidegrees Celsius.
        while True:
            self.tick += 1
            pit = min(1072, 240 + self.tick * 25)          # ramps up
            probe1 = min(710, 220 + self.tick * 8)         # meat slowly rising
            blower = 10000 if pit < 1000 else 3000         # eases off near target
            payload = {
                "name": "temps",
                "cook_id": 1380,
                "sec": 1784920711 + self.tick,
                "temps": [pit, probe1, -32767, -32767],
                "set_temp": 1072,
                "blower": blower,
            }
            await self.client.publish(
                f"flameboss/{self.args.device_id}/send/open", json.dumps(payload))
            log.debug("telemetry: pit=%d probe1=%d blower=%d", pit, probe1, blower)
            await asyncio.sleep(self.args.interval)

    # simulate a server migration ----------------------------------------
    async def migrate_later(self) -> None:
        if self.args.migrate_after <= 0 or len(self.args.servers) < 2:
            return
        await asyncio.sleep(self.args.migrate_after)
        self.server = self.args.servers[1]
        log.info(">>> simulating migration — device %s now on %s",
                 self.args.device_id, self.server)
        await self.announce_device()   # every server re-emits `connected` on (re)connect


def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Fake Flame Boss server for relay.py")
    p.add_argument("--broker", default="localhost")
    p.add_argument("--port", type=int, default=1883)
    p.add_argument("--user-id", type=int, default=42)
    p.add_argument("--device-id", type=int, default=123456)
    p.add_argument("--interval", type=float, default=3.0, help="telemetry period (s)")
    p.add_argument("--migrate-after", type=float, default=20.0,
                   help="seconds before simulating a server migration (0 = never)")
    p.add_argument("--servers", nargs="+", default=["localhost", "127.0.0.1"],
                   help="server values to report; the 2nd is used for migration")
    p.add_argument("-v", "--verbose", action="store_true")
    return p.parse_args()


async def main() -> None:
    args = parse_args()
    logging.basicConfig(
        level=logging.DEBUG if args.verbose else logging.INFO,
        format="%(asctime)s %(levelname)-7s %(name)s: %(message)s",
    )
    try:
        await Sim(args).run()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    asyncio.run(main())
