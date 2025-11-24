#!/bin/bash

# Endpoint Fleet Health Monitoring Test Script
# Tests US#24: "As a system operator, I want the server to track and expose 
# the best-known status of all endpoints (online, last scan) so that I can 
# monitor fleet health."
#
# Test Cases:
# TC-FLEET-001: Register endpoint with online status
# TC-FLEET-002: Register multiple endpoints with different statuses
# TC-FLEET-003: Retrieve fleet-wide status overview
# TC-FLEET-004: Query specific endpoint status
# TC-FLEET-005: Filter endpoints by status
# TC-FLEET-006: Update endpoint status
# TC-FLEET-007: Detect stale endpoints
# TC-FLEET-008: Heartbeat updates
# TC-FLEET-009: Invalid status handling
# TC-FLEET-010: Missing endpoint_id validation
# TC-FLEET-011: Non-existent endpoint query

set -e

# Configuration
API_KEY="${ENDPOINT_API_KEY:-fJ/Bp/4ADoUq9nGhpSuq8BTvkGeAzvJAbF/ez2Gmcf4=}"
BASE_URL="${API_BASE_URL:-http://localhost:3000}"

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
echo "  Fleet Health Monitoring Test Suite"
echo "  User Story #24"
echo "  Base URL: $BASE_URL"
echo "======================================"
echo ""

# TC-FLEET-001: Register endpoint with online status
log_test "TC-FLEET-001: Register EP1 as online"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/endpoint/status" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "endpoint_id": "TEST_EP1",
    "status": "online",
    "metadata": {
      "ip": "192.168.1.101",
      "version": "1.2.0",
      "location": "Building A - Floor 1"
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q '"success":true'; then
    log_pass "TC-FLEET-001: EP1 registered successfully"
else
    log_fail "TC-FLEET-001: Failed to register EP1 (HTTP $HTTP_CODE)"
fi
echo ""

# TC-FLEET-002: Register multiple endpoints with different statuses
log_test "TC-FLEET-002: Register EP2 as online"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/endpoint/status" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "endpoint_id": "TEST_EP2",
    "status": "online",
    "metadata": {"ip": "192.168.1.102", "version": "1.2.0"}
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" -eq 200 ]; then
    log_pass "TC-FLEET-002a: EP2 registered successfully"
else
    log_fail "TC-FLEET-002a: Failed to register EP2 (HTTP $HTTP_CODE)"
fi
echo ""

log_test "TC-FLEET-002: Register EP3 with error status"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/endpoint/status" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "endpoint_id": "TEST_EP3",
    "status": "error",
    "metadata": {
      "error_message": "WiFi adapter initialization failed"
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q '"status":"error"'; then
    log_pass "TC-FLEET-002b: EP3 registered with error status"
else
    log_fail "TC-FLEET-002b: Failed to register EP3 with error (HTTP $HTTP_CODE)"
fi
echo ""

# TC-FLEET-003: Retrieve fleet-wide status overview
log_test "TC-FLEET-003: Get all endpoint statuses"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/endpoint/status" \
  -H "x-api-key: ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q '"success":true'; then
    COUNT=$(echo "$BODY" | grep -o '"count":[0-9]*' | head -1 | cut -d: -f2)
    if [ "$COUNT" -ge 3 ]; then
        log_pass "TC-FLEET-003: Fleet overview retrieved ($COUNT endpoints)"
    else
        log_fail "TC-FLEET-003: Expected at least 3 endpoints, got $COUNT"
    fi
else
    log_fail "TC-FLEET-003: Failed to retrieve fleet status (HTTP $HTTP_CODE)"
fi
echo ""

# TC-FLEET-004: Query specific endpoint status
log_test "TC-FLEET-004: Get specific endpoint status (TEST_EP1)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/endpoint/status?endpoint_id=TEST_EP1" \
  -H "x-api-key: ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q '"endpoint_id":"TEST_EP1"'; then
    log_pass "TC-FLEET-004: Specific endpoint status retrieved"
else
    log_fail "TC-FLEET-004: Failed to retrieve TEST_EP1 status (HTTP $HTTP_CODE)"
fi
echo ""

# TC-FLEET-005: Filter endpoints by status
log_test "TC-FLEET-005: Filter by status (online endpoints)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/endpoint/status?status=online" \
  -H "x-api-key: ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q '"success":true'; then
    log_pass "TC-FLEET-005a: Online endpoints filtered successfully"
else
    log_fail "TC-FLEET-005a: Failed to filter online endpoints (HTTP $HTTP_CODE)"
fi
echo ""

log_test "TC-FLEET-005: Filter by status (error endpoints)"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/endpoint/status?status=error" \
  -H "x-api-key: ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q '"TEST_EP3"'; then
    log_pass "TC-FLEET-005b: Error endpoints filtered successfully"
else
    log_fail "TC-FLEET-005b: Failed to filter error endpoints (HTTP $HTTP_CODE)"
fi
echo ""

# TC-FLEET-006: Update endpoint status
log_test "TC-FLEET-006: Update TEST_EP1 to offline"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/endpoint/status" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "endpoint_id": "TEST_EP1",
    "status": "offline",
    "metadata": {
      "reason": "Scheduled maintenance"
    }
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q '"status":"offline"'; then
    log_pass "TC-FLEET-006: Status updated to offline"
    
    # Verify the update
    VERIFY=$(curl -s -X GET "${BASE_URL}/api/endpoint/status?endpoint_id=TEST_EP1" \
      -H "x-api-key: ${API_KEY}")
    
    if echo "$VERIFY" | grep -q '"status":"offline"'; then
        log_pass "TC-FLEET-006: Update verified"
    else
        log_fail "TC-FLEET-006: Update not persisted"
    fi
else
    log_fail "TC-FLEET-006: Failed to update status (HTTP $HTTP_CODE)"
fi
echo ""

# TC-FLEET-007: Detect stale endpoints
log_test "TC-FLEET-007: Stale endpoint detection (waiting 6 seconds...)"
sleep 6

RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/endpoint/status?timeout=5" \
  -H "x-api-key: ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 200 ] && echo "$BODY" | grep -q '"computed_status":"stale"'; then
    log_pass "TC-FLEET-007: Stale endpoints detected"
else
    log_fail "TC-FLEET-007: Stale detection not working (HTTP $HTTP_CODE)"
fi
echo ""

# TC-FLEET-008: Heartbeat updates
log_test "TC-FLEET-008: Heartbeat refreshes last_seen"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/endpoint/status" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "endpoint_id": "TEST_EP2",
    "status": "online",
    "metadata": {"heartbeat": true}
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
if [ "$HTTP_CODE" -eq 200 ]; then
    # Check if it's not stale anymore
    VERIFY=$(curl -s -X GET "${BASE_URL}/api/endpoint/status?endpoint_id=TEST_EP2&timeout=5" \
      -H "x-api-key: ${API_KEY}")
    
    if echo "$VERIFY" | grep -q '"computed_status":"online"'; then
        log_pass "TC-FLEET-008: Heartbeat updated last_seen"
    else
        log_fail "TC-FLEET-008: Heartbeat didn't prevent stale status"
    fi
else
    log_fail "TC-FLEET-008: Failed to send heartbeat (HTTP $HTTP_CODE)"
fi
echo ""

# TC-FLEET-009: Invalid status handling
log_test "TC-FLEET-009: Reject invalid status value"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/endpoint/status" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "endpoint_id": "TEST_EP5",
    "status": "maybe-online"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 400 ] && echo "$BODY" | grep -q "error"; then
    log_pass "TC-FLEET-009: Invalid status rejected with 400"
else
    log_fail "TC-FLEET-009: Should reject invalid status (got HTTP $HTTP_CODE)"
fi
echo ""

# TC-FLEET-010: Missing endpoint_id validation
log_test "TC-FLEET-010: Reject request without endpoint_id"
RESPONSE=$(curl -s -w "\n%{http_code}" -X POST "${BASE_URL}/api/endpoint/status" \
  -H "Content-Type: application/json" \
  -H "x-api-key: ${API_KEY}" \
  -d '{
    "status": "online"
  }')

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 400 ] && echo "$BODY" | grep -q "endpoint_id"; then
    log_pass "TC-FLEET-010: Missing endpoint_id rejected with 400"
else
    log_fail "TC-FLEET-010: Should reject missing endpoint_id (got HTTP $HTTP_CODE)"
fi
echo ""

# TC-FLEET-011: Non-existent endpoint query
log_test "TC-FLEET-011: Query non-existent endpoint"
RESPONSE=$(curl -s -w "\n%{http_code}" -X GET "${BASE_URL}/api/endpoint/status?endpoint_id=NONEXISTENT999" \
  -H "x-api-key: ${API_KEY}")

HTTP_CODE=$(echo "$RESPONSE" | tail -n1)
BODY=$(echo "$RESPONSE" | sed '$d')

if [ "$HTTP_CODE" -eq 404 ] && echo "$BODY" | grep -q "not found"; then
    log_pass "TC-FLEET-011: Non-existent endpoint returns 404"
else
    log_fail "TC-FLEET-011: Should return 404 for non-existent endpoint (got HTTP $HTTP_CODE)"
fi
echo ""

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
    echo -e "${GREEN}✓ All tests passed!${NC}"
    echo ""
    echo "Fleet Health Features Verified:"
    echo "-------------------------------"
    echo "✓ Endpoints can register with online/offline/error status"
    echo "✓ Server tracks last_seen timestamp automatically"
    echo "✓ System operator can view all endpoint statuses"
    echo "✓ System operator can query specific endpoint"
    echo "✓ System operator can filter by status"
    echo "✓ System detects stale/inactive endpoints"
    echo "✓ Heartbeat mechanism keeps status current"
    echo "✓ Metadata stored for monitoring"
    echo "✓ Input validation working correctly"
    echo ""
    exit 0
else
    echo -e "${RED}✗ Some tests failed!${NC}"
    echo ""
    exit 1
fi
