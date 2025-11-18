#!/bin/bash
# Automated API Test Suite for Sprint 5
# References: Testing Issue #XX (link to GitHub issue once created)
# 
# Test Cases:
# TC-API-001: Test endpoint scan data submission
# TC-API-002: Test device location query
# TC-API-003: Test endpoint status API
# TC-API-004: Test floorplan API
# TC-API-005: Test authentication APIs

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-http://localhost:3000}"
API_KEY="${ENDPOINT_API_KEY:-your_api_key_here}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TESTS_RUN=0
TESTS_PASSED=0
TESTS_FAILED=0

# Helper functions
log_test() {
    echo -e "${YELLOW}[TEST]${NC} $1"
    TESTS_RUN=$((TESTS_RUN + 1))
}

log_pass() {
    echo -e "${GREEN}[PASS]${NC} $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
    echo -e "${RED}[FAIL]${NC} $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

echo "======================================"
echo "  ZOPAC API Test Suite - Sprint 5"
echo "  Base URL: $API_BASE_URL"
echo "======================================"
echo ""

# TC-API-001: Test endpoint scan data submission
log_test "TC-API-001: Endpoint can submit scan data"
RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/endpoint/scan-data" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "scans": [{
      "endpoint_id": "TEST_EP1",
      "mac": "aa:bb:cc:dd:ee:ff",
      "rssi": -65,
      "timestamp": "2025-11-17T12:00:00Z"
    }]
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
    log_pass "TC-API-001: Scan data accepted"
else
    log_fail "TC-API-001: Scan data rejected - $RESPONSE"
fi

# TC-API-002: Test device location query
log_test "TC-API-002: Device location query returns valid data"
RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/query/all-devices?max_age=300" \
  -H "x-api-key: $API_KEY")

if echo "$RESPONSE" | grep -q '"success":true'; then
    log_pass "TC-API-002: Device location query successful"
else
    log_fail "TC-API-002: Device location query failed - $RESPONSE"
fi

# TC-API-003: Test endpoint status API
log_test "TC-API-003: Endpoint status monitoring"
RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/endpoint/status" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "endpoint_id": "TEST_EP1",
    "status": "online",
    "metadata": {"version": "1.0.0"}
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
    log_pass "TC-API-003: Endpoint status updated"
else
    log_fail "TC-API-003: Endpoint status update failed - $RESPONSE"
fi

# TC-API-004: Test floorplan API
log_test "TC-API-004: Floorplan upload and retrieval"
RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/floorplan" \
  -H "x-api-key: $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "floor": 99,
    "name": "Test Floor",
    "width": 100,
    "height": 100,
    "image_url": "https://example.com/test.png"
  }')

if echo "$RESPONSE" | grep -q '"success":true'; then
    log_pass "TC-API-004: Floorplan created"
else
    log_fail "TC-API-004: Floorplan creation failed - $RESPONSE"
fi

# TC-API-005: Test authentication
log_test "TC-API-005: User authentication"
TIMESTAMP=$(date +%s)
TEST_EMAIL="test_${TIMESTAMP}@example.com"
RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/auth/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"TestPass123!\"
  }")

if echo "$RESPONSE" | grep -q '"success":true\|"id"'; then
    log_pass "TC-API-005: User signup successful"
else
    log_fail "TC-API-005: User signup failed - $RESPONSE"
fi

# Test Summary
echo ""
echo "======================================"
echo "  Test Summary"
echo "======================================"
echo "Tests Run:    $TESTS_RUN"
echo "Tests Passed: $TESTS_PASSED"
echo "Tests Failed: $TESTS_FAILED"
echo ""

if [ $TESTS_FAILED -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed!${NC}"
    exit 1
fi
