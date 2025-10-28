#!/bin/bash
set -euo pipefail

# --- CONFIGURABLE VARIABLES ---
IFACE="${1:-wlan1}"                      # network interface (default: wlan1)
LOGDIR="${2:-./logs}"                    # output directory
PYTHON="${PYTHON:-python3}"              # python executable

mkdir -p "$LOGDIR"

# --- Timestamped file names ---
ts="$(date +%Y%m%d_%H%M%S)"
RAW_LOG="$LOGDIR/capture_${IFACE}_${ts}.log"
PARSED_LOG="$LOGDIR/parsed_${IFACE}_${ts}.jsonl"

# --- Ensure monitor mode setup ---
# This script configures wlan1 for monitor mode and sets channel.
# setup_monitor.sh must be located in the same project directory.
echo "Running setup_monitor.sh for $IFACE..."
sudo /home/pi/WiFi_Project/setup_monitor.sh "$IFACE"

# --- Channel setting (optional, adjust as needed) ---
sudo iw dev "$IFACE" set channel 6

echo "Starting Wi-Fi capture on $IFACE..."
echo "Raw output  → $RAW_LOG"
echo "Parsed JSON → $PARSED_LOG"
echo "Press CTRL + C to stop."

# --- Run tcpdump and parse in real time ---
sudo tcpdump -i "$IFACE" -s 0 -l -e -tt -n -vvv \
| tee "$RAW_LOG" \
| $PYTHON -u /home/pi/WiFi_Project/parser_scan.py --out "$PARSED_LOG"