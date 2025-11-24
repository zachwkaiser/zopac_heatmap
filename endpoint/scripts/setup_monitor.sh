#!/bin/bash
set -euo pipefail

IFACE="${1:-wlan1}"
CHANNEL="${2:-6}"

echo "[setup_monitor] Setting interface $IFACE into monitor mode on channel $CHANNEL"

# Optionally tell NetworkManager to leave it alone (if present)
if command -v nmcli >/dev/null 2>&1; then
    sudo nmcli dev set "$IFACE" managed no || true
fi

# Bring interface down (ignore error if already down)
sudo ip link set "$IFACE" down || true

# Ensure monitor mode (ignore error if it is already monitor)
sudo iw dev "$IFACE" set type monitor || true

# Bring interface back up
sudo ip link set "$IFACE" up || true

# Force a channel change to "wake up" the radio
ALT_CH="1"
if [ "$CHANNEL" = "$ALT_CH" ]; then
    ALT_CH="6"
fi

echo "[setup_monitor] Forcing channel hop to $ALT_CH then back to $CHANNEL"
sudo iw dev "$IFACE" set channel "$ALT_CH" || true
sleep 1
sudo iw dev "$IFACE" set channel "$CHANNEL"

echo "[setup_monitor] Current interface state:"
iw dev "$IFACE" info || true

echo "[setup_monitor] $IFACE is now in monitor mode on channel $CHANNEL"
