# Flame Boss Home Assistant Add-ons

Home Assistant add-ons for connecting Flame Boss controllers.

[![Add repository to your Home Assistant instance](https://my.home-assistant.io/badges/supervisor_add_addon_repository.svg)](https://my.home-assistant.io/redirect/supervisor_add_addon_repository/?repository_url=https%3A%2F%2Fgithub.com%2Fflameboss%2Fhassio-addons)

## Install

1. In Home Assistant, go to **Settings → Add-ons → Add-on Store → ⋮ → Repositories**.
2. Add: `https://github.com/flameboss/hassio-addons`
3. Install the **Flame Boss** add-on and configure it.

(Or click the badge above to add the repository in one step.)

## Add-ons

- **Flame Boss** — relays your controllers into Home Assistant over MQTT and
  creates the entities automatically, following devices across Flame Boss
  servers. See [`flameboss/DOCS.md`](flameboss/DOCS.md).

---

> **Assembling this repo (maintainers).** In the `fb-api-doc` repo this scaffold
> lives under `home-assistant/addon-repo/`. To create the real distribution repo:
>
> 1. New repo `flameboss/hassio-addons`.
> 2. Copy `repository.yaml`, this `README.md`, and `.github/` to its root.
> 3. Copy `home-assistant/addon/` in as `flameboss/`, and **commit**
>    `relay.py` + `requirements.txt` there (drop the `make sync` + `.gitignore`;
>    they exist only to avoid a duplicate copy inside the doc repo).
> 4. Push. The workflow builds and publishes multi-arch images to GHCR on each
>    change to `flameboss/**`.
