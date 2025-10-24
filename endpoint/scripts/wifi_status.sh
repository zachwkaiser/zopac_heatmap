#!/bin/bash

SERVICE="wifi-capture.service"
IFACE="${1:-wlan1}"      # Optional: pass wlan1 or mon1 to check interface

echo "===== Wi-Fi Capture Status ====="
sudo systemctl status "$SERVICE" --no-pager -l | grep -E "Active:|Main PID|ExecStart" || echo "Service not found."

echo
echo "===== Network Interface Info ====="
iw dev "$IFACE" info 2>/dev/null || echo "Interface $IFACE not found or inactive."

echo
echo "===== Recent Log Entries ====="
sudo journalctl -u "$SERVICE" -n 5 --no-pager