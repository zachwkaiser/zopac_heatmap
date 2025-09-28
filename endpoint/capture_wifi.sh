#!bin/bash
set -euo pipefail

IFACE = "${1:-wlan1}"
LOGDIR = "${2:-./logs}"

mkdir -p "$LOGDIR"
timeStamp = "$(date +%Y%m%d_%H%M%S)"
outfile = "$logdir/captures_${IFACE}_${timeStamp}.log"

echo "Starting tcpdump on $IFACE"
echo "Writing to $outfile (CTRL + C to stop)"

sudo tcpdump-i "$IFACE" -s 0 -1 -e -tt -n -vvv >"outfile"