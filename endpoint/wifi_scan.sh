#!/bin/bash
set -euo pipefail

IFACE="${IFACE:-wlan1}"
DURATION="${DURATION:-300}"
LOGDIR="${LOGDIR:-./captures}"

mkdir -p "$LOGDIR"

echo "Interface: $IFACE"
echo "Duration: ${DURATION} seconds"
echo "Log Directory: $LOGDIR"

echo "Switching $IFACE to monitor mode"
sudo ip link set $IFACE down
sudo iw dev "$IFACE" set type monitor
sudo ip link set "$IFACE" up

sleep 2

sudo iw dev $IFACE set channel 1

ts="$(date +%Y%m%d_%H%M%S)"
outfile="$LOGDIR/scan_${ts}.txt"

echo "Capturing on $IFACE → $outfile  (for ${DURATION}s)"
sudo timeout "$DURATION" tcpdump -i "$IFACE" -s 0 -e -tt -n -vvv >"$outfile" 2>&1 || true
echo "Capture complete."


echo "Restoring $IFACE to managed mode"
sudo ip link set "$IFACE" down
sudo iw dev "$IFACE" set type managed
sudo ip link set "$IFACE" up