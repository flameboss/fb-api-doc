# Flame Boss add-on

Relays your Flame Boss controllers into Home Assistant over MQTT and creates the
entities automatically (pit, meat probes, set temp, fan). It connects the way the
Flame Boss mobile apps do, so it follows your controllers across Flame Boss
servers with nothing to reconfigure.

How it works under the hood: [../ARCHITECTURE.md](../ARCHITECTURE.md).

## Prerequisites

- The **Mosquitto broker** add-on (or another MQTT broker) installed and running.
  This add-on reads its connection details automatically.
- Your Flame Boss **MQTT credentials** from your Developer page:
  `https://myflameboss.com/en/users/dev`.

## Installation

1. Add this add-on repository to Home Assistant
   (Settings → Add-ons → ⋮ → Repositories) and install **Flame Boss**, or build
   it locally (see the Makefile).
2. Open the **Configuration** tab and set the options below.
3. **Start** the add-on and check the **Log** tab.

Your controllers appear under **Settings → Devices & Services → MQTT** as devices
named **"Flame Boss `<device id>`"**.

## Options

| Option | Meaning |
| --- | --- |
| `fb_cloud` | Flame Boss cloud host. `myflameboss.com` (default), or `fb.oak.flameboss.com` for the test server. The relay only connects to this host and its subdomains, so a spoofed message can't redirect it elsewhere. |
| `fb_user_id` | Your Flame Boss numeric user id. The MQTT username (`T-<id>`) is derived from it. |
| `fb_token` | MQTT password / API token from the Developer page. |
| `units` | `f` for °F or `c` for °C. |

Example:

```yaml
fb_cloud: myflameboss.com
fb_user_id: 42
fb_token: "your-api-token"
units: f
```

## Troubleshooting

- **"No MQTT service found"** — install and start the Mosquitto broker add-on.
- **No entities appear** — check the add-on Log for authentication errors; verify
  `user_id`, `fb_user`, and `fb_token`. Make sure a controller is online.
- **A probe shows "Unavailable"** — that's correct for an unplugged probe
  (`-32767`). It comes online when you connect it.

See also the end-user guide: [../setup.md](../setup.md).

---

## Distributing this add-on

This directory is reference packaging inside the API-doc repo. To ship it as an
installable add-on, move it into a dedicated **add-on repository** — a git repo
with a top-level `repository.yaml`:

```yaml
name: Flame Boss Add-ons
url: https://github.com/flameboss/hassio-addons
maintainer: Flame Boss <support@flameboss.com>
```

with this add-on in a subfolder (e.g. `flameboss/`). In that repo, commit
`relay.py` and `requirements.txt` alongside the Dockerfile instead of syncing
them from `../prototype`. Users then add the repo URL under
Settings → Add-ons → ⋮ → Repositories.
