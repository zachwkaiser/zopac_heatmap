#!/bin/bash

# Test CORS and Floorplan API
# Make sure server is running on port 3000 first

API_KEY="fJ/Bp/4ADoUq9nGhpSuq8BTvkGeAzvJAbF/ez2Gmcf4="
BASE_URL="http://localhost:3000"

echo "========================================="
echo "Testing CORS and Floorplan API"
echo "========================================="
echo ""

# Test 1: Upload floorplan
echo "1. Testing POST /api/floorplan"
echo "Uploading floorplan for floor 1..."
curl -s -X POST "${BASE_URL}/api/floorplan" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "floor": 1,
    "name": "First Floor",
    "width": 10.0,
    "height": 8.0,
    "image_url": "https://example.com/floorplan1.png"
  }' | python3 -m json.tool

echo ""
echo ""

# Test 2: Get specific floorplan
echo "2. Testing GET /api/floorplan?floor=1"
echo "Retrieving floorplan for floor 1..."
curl -s -X GET "${BASE_URL}/api/floorplan?floor=1" \
  -H "x-api-key: ${API_KEY}" | python3 -m json.tool

echo ""
echo ""

# Test 3: Get all floorplans
echo "3. Testing GET /api/floorplan (all floors)"
echo "Retrieving all floorplans..."
curl -s -X GET "${BASE_URL}/api/floorplan" \
  -H "x-api-key: ${API_KEY}" | python3 -m json.tool

echo ""
echo ""

# Test 4: Test CORS headers
echo "4. Testing CORS headers"
echo "Making preflight request..."
curl -s -X OPTIONS "${BASE_URL}/api/floorplan" \
  -H "Origin: http://localhost:5173" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type, x-api-key" \
  -i | head -20

echo ""
echo "========================================="
echo "Testing complete!"
echo "========================================="
