#!/usr/bin/with-contenv bashio
# Reads add-on options + the MQTT service credentials, maps them to the
# relay's FB_RELAY_* environment variables, and starts it.
set -e

# ── add-on options ──────────────────────────────────────────────────────────
fb_user_id="$(bashio::config 'fb_user_id')"
if ! bashio::var.has_value "${fb_user_id}" || [ "${fb_user_id}" -le 0 ]; then
  bashio::exit.nok "Set your Flame Boss 'fb_user_id' in the add-on Configuration."
fi
if ! bashio::config.has_value 'fb_token'; then
  bashio::exit.nok "Set your Flame Boss 'fb_token' (from your Developer page)."
fi

export FB_RELAY_FB_CLOUD="$(bashio::config 'fb_cloud')"
export FB_RELAY_FB_USER_ID="${fb_user_id}"
export FB_RELAY_FB_TOKEN="$(bashio::config 'fb_token')"
export FB_RELAY_UNITS="$(bashio::config 'units')"

# ── MQTT broker credentials (from the Mosquitto add-on / MQTT service) ───────
if ! bashio::services.available "mqtt"; then
  bashio::exit.nok "No MQTT service found — install and start the Mosquitto broker add-on."
fi
export FB_RELAY_HA_HOST="$(bashio::services 'mqtt' 'host')"
export FB_RELAY_HA_PORT="$(bashio::services 'mqtt' 'port')"
export FB_RELAY_HA_USER="$(bashio::services 'mqtt' 'username')"
export FB_RELAY_HA_PASS="$(bashio::services 'mqtt' 'password')"

bashio::log.info "Starting Flame Boss relay (cloud=${FB_RELAY_FB_CLOUD}, user=${FB_RELAY_FB_USER_ID}, units=${FB_RELAY_UNITS})"
exec python3 /app/relay.py -v
