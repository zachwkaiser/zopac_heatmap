#!/bin/bash
set -euo pipefail

IFACE="${1:-wlan1}"
echo "Setting interface $IFACE into monitor mode"

sudo ip link set "$IFACE" down
sudo iw dev "$IFACE" set type monitor
sudo ip link set "$IFACE" up

echo "$IFACE is now in monitor mode"$