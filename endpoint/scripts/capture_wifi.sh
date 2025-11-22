#!/bin/bash
set -euo pipefail

# --- CONFIGURABLE VARIABLES ---
IFACE="${1:-wlan1}"          # network interface (default: wlan1)
LOGDIR="${2:-./logs}"        # output directory
CHANNEL="${3:-6}"            # Wi-Fi channel (default: 6)
PYTHON="${PYTHON:-python3}"  # python executable

mkdir -p "$LOGDIR"

# --- Timestamped file names ---
ts="$(date +%Y%m%d_%H%M%S)"
RAW_LOG="$LOGDIR/capture_${IFACE}_${ts}.log"
PARSED_LOG="$LOGDIR/parsed_${IFACE}_${ts}.jsonl"

# --- Safety: kill any leftover tcpdump using this interface ---
echo "[capture_wifi] Killing any previous tcpdump on $IFACE (if running)..."
sudo pkill -f "tcpdump -i $IFACE" || true

# --- Ensure monitor mode setup ---
echo "Running setup_monitor.sh for $IFACE on channel $CHANNEL..."
sudo /home/pi/WiFi_Project/setup_monitor.sh "$IFACE" "$CHANNEL"

echo "Starting Wi-Fi capture on $IFACE (channel $CHANNEL)..."
echo "Raw output  -> $RAW_LOG"
echo "Parsed JSON -> $PARSED_LOG"
echo "Press CTRL + C to stop."

cleanup() {
    echo
    echo "[capture_wifi] Stopping capture..."
}
trap cleanup INT TERM

# --- Run tcpdump and stream in real time ---
sudo tcpdump -i "$IFACE" -s 0 -l -e -tt -n -vvv \
  | tee "$RAW_LOG" \
  | "$PYTHON" -u /home/pi/WiFi_Project/stream.py --tee-jsonl "$PARSED_LOG"
