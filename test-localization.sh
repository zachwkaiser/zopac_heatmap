#!/bin/bash

# Localization API Test Script
# Run this after starting the server with: cd server && npm run dev

API_KEY="fJ/Bp/4ADoUq9nGhpSuq8BTvkGeAzvJAbF/ez2Gmcf4="
BASE_URL="http://localhost:3000"

echo "======================================"
echo "Testing Indoor Localization API"
echo "======================================"
echo ""

# Step 1: Setup database schema
echo "1. Creating database tables..."
curl -X POST "$BASE_URL/api/endpoint/setup-db" \
  -H "x-api-key: $API_KEY" \
  -s | jq '.'
echo ""

# Step 2: Configure endpoint positions (4 corners of a 15m x 10m room)
echo "2. Configuring endpoint positions..."
curl -X POST "$BASE_URL/api/endpoint/positions" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "endpoint_id": "EP001",
      "x": 0,
      "y": 0,
      "floor": 1,
      "description": "Northwest corner"
    },
    {
      "endpoint_id": "EP002",
      "x": 15,
      "y": 0,
      "floor": 1,
      "description": "Northeast corner"
    },
    {
      "endpoint_id": "EP003",
      "x": 0,
      "y": 10,
      "floor": 1,
      "description": "Southwest corner"
    },
    {
      "endpoint_id": "EP004",
      "x": 15,
      "y": 10,
      "floor": 1,
      "description": "Southeast corner"
    }
  ]' \
  -s | jq '.'
echo ""

# Step 3: Verify endpoint positions
echo "3. Verifying endpoint positions..."
curl -H "x-api-key: $API_KEY" \
  "$BASE_URL/api/endpoint/positions" \
  -s | jq '.'
echo ""

# Step 4: Send test scan data (device at center: 7.5, 5)
echo "4. Sending test scan data (device should be near center at 7.5, 5)..."
curl -X POST "$BASE_URL/api/endpoint/scan-data" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "endpoint_id": "EP001",
      "mac": "AA:BB:CC:DD:EE:01",
      "rssi": -50,
      "timestamp": "2025-10-26T12:00:00Z"
    },
    {
      "endpoint_id": "EP002",
      "mac": "AA:BB:CC:DD:EE:01",
      "rssi": -50,
      "timestamp": "2025-10-26T12:00:00Z"
    },
    {
      "endpoint_id": "EP003",
      "mac": "AA:BB:CC:DD:EE:01",
      "rssi": -50,
      "timestamp": "2025-10-26T12:00:00Z"
    },
    {
      "endpoint_id": "EP004",
      "mac": "AA:BB:CC:DD:EE:01",
      "rssi": -50,
      "timestamp": "2025-10-26T12:00:00Z"
    }
  ]' \
  -s | jq '.'
echo ""

# Step 5: Query device location
echo "5. Querying device location..."
curl "$BASE_URL/api/query/device-location?mac=AA:BB:CC:DD:EE:01" \
  -s | jq '.'
echo ""

# Step 6: Send scan data for device near EP001 (0, 0)
echo "6. Sending scan data for device near EP001 (0, 0)..."
curl -X POST "$BASE_URL/api/endpoint/scan-data" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '[
    {
      "endpoint_id": "EP001",
      "mac": "AA:BB:CC:DD:EE:02",
      "rssi": -35,
      "timestamp": "2025-10-26T12:01:00Z"
    },
    {
      "endpoint_id": "EP002",
      "mac": "AA:BB:CC:DD:EE:02",
      "rssi": -65,
      "timestamp": "2025-10-26T12:01:00Z"
    },
    {
      "endpoint_id": "EP003",
      "mac": "AA:BB:CC:DD:EE:02",
      "rssi": -60,
      "timestamp": "2025-10-26T12:01:00Z"
    },
    {
      "endpoint_id": "EP004",
      "mac": "AA:BB:CC:DD:EE:02",
      "rssi": -75,
      "timestamp": "2025-10-26T12:01:00Z"
    }
  ]' \
  -s | jq '.'
echo ""

echo "7. Querying location for device near EP001..."
curl "$BASE_URL/api/query/device-location?mac=AA:BB:CC:DD:EE:02" \
  -s | jq '.'
echo ""

# Step 8: Query multiple devices
echo "8. Querying multiple devices at once..."
curl -X POST "$BASE_URL/api/query/device-location" \
  -H "Content-Type: application/json" \
  -d '{
    "macs": ["AA:BB:CC:DD:EE:01", "AA:BB:CC:DD:EE:02"],
    "max_age": 120,
    "min_rssi": -90
  }' \
  -s | jq '.'
echo ""

echo "======================================"
echo "Test Complete!"
echo "======================================"
echo ""
echo "Expected results:"
echo "- Device AA:BB:CC:DD:EE:01 should be near (7.5, 5) - center of room"
echo "- Device AA:BB:CC:DD:EE:02 should be near (0, 0) - northwest corner"
echo ""
