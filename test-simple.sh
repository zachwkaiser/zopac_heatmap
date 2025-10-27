#!/bin/bash

# Simple localization test without jq dependency
# Run after starting: cd server && npm run dev

API_KEY="fJ/Bp/4ADoUq9nGhpSuq8BTvkGeAzvJAbF/ez2Gmcf4="

echo "Testing localization..."
echo ""

# Insert scan data
echo "1. Inserting scan data..."
curl -X POST http://localhost:3000/api/endpoint/scan-data \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {"endpoint_id": "EP001", "mac": "AA:BB:CC:DD:EE:01", "rssi": -50, "timestamp": "2025-10-26T13:00:00Z"},
    {"endpoint_id": "EP002", "mac": "AA:BB:CC:DD:EE:01", "rssi": -50, "timestamp": "2025-10-26T13:00:00Z"},
    {"endpoint_id": "EP003", "mac": "AA:BB:CC:DD:EE:01", "rssi": -50, "timestamp": "2025-10-26T13:00:00Z"},
    {"endpoint_id": "EP004", "mac": "AA:BB:CC:DD:EE:01", "rssi": -50, "timestamp": "2025-10-26T13:00:00Z"}
  ]'
echo ""
echo ""

# Query location
echo "2. Querying device location..."
curl "http://localhost:3000/api/query/device-location?mac=AA:BB:CC:DD:EE:01"
echo ""
echo ""

echo "Done! Device should be located near (7.5, 5) - center of the room."
