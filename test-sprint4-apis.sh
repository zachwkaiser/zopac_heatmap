#!/bin/bash

# Test Endpoint Status and Bulk Device Query APIs
# Make sure server is running on port 3000 first

API_KEY="fJ/Bp/4ADoUq9nGhpSuq8BTvkGeAzvJAbF/ez2Gmcf4="
BASE_URL="http://localhost:3000"

echo "========================================="
echo "Testing Endpoint Status and Device Query APIs"
echo "========================================="
echo ""

# Test 1: Update endpoint status
echo "1. Testing POST /api/endpoint/status"
echo "Updating status for EP1..."
curl -s -X POST "${BASE_URL}/api/endpoint/status" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "endpoint_id": "EP1",
    "status": "online",
    "metadata": {"ip": "192.168.1.10", "version": "1.0"}
  }' | python3 -m json.tool

echo ""
echo ""

# Test 2: Get all endpoint statuses
echo "2. Testing GET /api/endpoint/status (all endpoints)"
echo "Retrieving all endpoint statuses..."
curl -s -X GET "${BASE_URL}/api/endpoint/status" \
  -H "x-api-key: ${API_KEY}" | python3 -m json.tool

echo ""
echo ""

# Test 3: Get specific endpoint status
echo "3. Testing GET /api/endpoint/status?endpoint_id=EP1"
echo "Retrieving status for EP1..."
curl -s -X GET "${BASE_URL}/api/endpoint/status?endpoint_id=EP1" \
  -H "x-api-key: ${API_KEY}" | python3 -m json.tool

echo ""
echo ""

# Test 4: Query all active devices
echo "4. Testing GET /api/query/all-devices"
echo "Querying all active devices in room..."
curl -s -X GET "${BASE_URL}/api/query/all-devices?max_age=60&min_rssi=-90" \
  -H "x-api-key: ${API_KEY}" | python3 -m json.tool

echo ""
echo ""

# Test 5: Query specific devices (batch)
echo "5. Testing POST /api/query/all-devices"
echo "Querying specific list of devices..."
curl -s -X POST "${BASE_URL}/api/query/all-devices" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "macs": ["aa:bb:cc:dd:ee:ff", "11:22:33:44:55:66"],
    "max_age": 60,
    "min_rssi": -90
  }' | python3 -m json.tool

echo ""
echo "========================================="
echo "Testing complete!"
echo "========================================="
