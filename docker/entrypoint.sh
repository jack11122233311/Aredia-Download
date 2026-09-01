#!/bin/sh
set -e

PUID=${PUID:-1000}
PGID=${PGID:-1000}

# Create app user/group if they don't exist
if ! getent group ytdl >/dev/null 2>&1; then
    groupadd -g "$PGID" ytdl 2>/dev/null || groupadd ytdl
fi

if ! getent passwd ytdl >/dev/null 2>&1; then
    useradd -u "$PUID" -g "$PGID" -d /app -s /bin/sh ytdl 2>/dev/null || useradd -g ytdl -d /app -s /bin/sh ytdl
fi

# Ensure permissions on download and config directories
mkdir -p /downloads /config
chown -R "$PUID:$PGID" /downloads /config /app 2>/dev/null || true

# If command starts with uvicorn or python, execute with gosu as ytdl user
if [ "$(id -u)" = '0' ]; then
    exec gosu "$PUID:$PGID" "$@"
fi

exec "$@"
