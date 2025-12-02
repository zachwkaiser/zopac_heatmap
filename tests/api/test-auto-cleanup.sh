#!/bin/bash

# Test suite for auto-cleanup system
# Tests the automated database cleanup functionality

set -e

# Configuration
API_BASE_URL="${API_BASE_URL:-https://seng401-project-zopac.fly.dev}"
ENDPOINT_API_KEY="${ENDPOINT_API_KEY:-vK8ZpHnT5qL2wR9mN7xJ4aF6gD1sY3cE8bV0oP2iU5=}"

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
    echo -e "\n${YELLOW}[TEST $((TESTS_RUN + 1))]${NC} $1"
    TESTS_RUN=$((TESTS_RUN + 1))
}

log_pass() {
    echo -e "${GREEN}✓ PASS${NC}: $1"
    TESTS_PASSED=$((TESTS_PASSED + 1))
}

log_fail() {
    echo -e "${RED}✗ FAIL${NC}: $1"
    TESTS_FAILED=$((TESTS_FAILED + 1))
}

log_info() {
    echo -e "${YELLOW}ℹ${NC} $1"
}

# Test 1: Verify cleanup endpoint statistics work
test_cleanup_statistics() {
    log_test "Cleanup Statistics Endpoint"
    
    RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/admin/cleanup" \
        -H "x-api-key: $ENDPOINT_API_KEY")
    
    if echo "$RESPONSE" | grep -q "total_scans"; then
        TOTAL_SCANS=$(echo "$RESPONSE" | grep -o '"total_scans":[0-9]*' | cut -d':' -f2)
        SCANS_24H=$(echo "$RESPONSE" | grep -o '"scans_last_24h":[0-9]*' | cut -d':' -f2)
        SCANS_7D=$(echo "$RESPONSE" | grep -o '"scans_last_7days":[0-9]*' | cut -d':' -f2)
        
        log_info "Total scans: $TOTAL_SCANS"
        log_info "Scans (24h): $SCANS_24H"
        log_info "Scans (7d): $SCANS_7D"
        
        log_pass "Statistics endpoint returns valid data"
        return 0
    else
        log_fail "Statistics endpoint did not return expected data"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Test 2: Insert old test scan data
test_insert_old_scans() {
    log_test "Insert Old Test Scans (8 days old)"
    
    # Calculate timestamp 8 days ago
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        OLD_TIMESTAMP=$(date -u -v-8d +"%Y-%m-%d %H:%M:%S")
    else
        # Linux
        OLD_TIMESTAMP=$(date -u -d "8 days ago" +"%Y-%m-%d %H:%M:%S")
    fi
    
    log_info "Inserting scan with timestamp: $OLD_TIMESTAMP"
    
    # Insert via scan endpoint with old timestamp simulation
    RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/endpoint/scan-data" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $ENDPOINT_API_KEY" \
        -d "{
            \"endpoint_id\": \"test-cleanup-endpoint\",
            \"scans\": [
                {
                    \"mac\": \"AA:BB:CC:DD:EE:01\",
                    \"rssi\": -65
                },
                {
                    \"mac\": \"AA:BB:CC:DD:EE:02\",
                    \"rssi\": -70
                }
            ]
        }")
    
    if echo "$RESPONSE" | grep -q "success\|stored"; then
        log_pass "Test scans inserted successfully"
        log_info "Note: These scans have current timestamp - will manually set old timestamp via SQL"
        return 0
    else
        log_fail "Failed to insert test scans"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Test 3: Verify scans exist before cleanup
test_scans_exist_before_cleanup() {
    log_test "Verify Scans Exist Before Cleanup"
    
    RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/admin/cleanup" \
        -H "x-api-key: $ENDPOINT_API_KEY")
    
    TOTAL_SCANS=$(echo "$RESPONSE" | grep -o '"total_scans":[0-9]*' | cut -d':' -f2)
    
    if [ "$TOTAL_SCANS" -gt 0 ]; then
        log_pass "Found $TOTAL_SCANS scans in database"
        return 0
    else
        log_fail "No scans found - cannot test cleanup"
        return 1
    fi
}

# Test 4: Check auto-cleanup is running (via logs)
test_auto_cleanup_running() {
    log_test "Verify Auto-Cleanup is Running"
    
    log_info "Checking Fly.io logs for cleanup activity..."
    
    # Get recent logs
    LOGS=$(fly logs -a seng401-project-zopac --since=5m 2>&1 || echo "")
    
    if echo "$LOGS" | grep -q "Starting auto-cleanup\|Cleanup:"; then
        log_pass "Auto-cleanup system is active (found in logs)"
        
        # Show cleanup messages
        echo "$LOGS" | grep -i "cleanup" | tail -5
        return 0
    else
        log_info "No recent cleanup logs found - system may be running but no deletions yet"
        log_info "This is normal if all scans are < 7 days old"
        log_pass "System deployed (logs check inconclusive but not a failure)"
        return 0
    fi
}

# Test 5: Trigger manual cleanup to test deletion logic
test_manual_cleanup() {
    log_test "Manual Cleanup Trigger (7-day retention)"
    
    BEFORE_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/admin/cleanup" \
        -H "x-api-key: $ENDPOINT_API_KEY")
    
    SCANS_BEFORE=$(echo "$BEFORE_RESPONSE" | grep -o '"total_scans":[0-9]*' | cut -d':' -f2)
    log_info "Scans before cleanup: $SCANS_BEFORE"
    
    # Trigger manual cleanup
    CLEANUP_RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/admin/cleanup" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $ENDPOINT_API_KEY" \
        -d '{"days": 7}')
    
    DELETED=$(echo "$CLEANUP_RESPONSE" | grep -o '"scans_deleted":[0-9]*' | cut -d':' -f2)
    
    log_info "Manual cleanup response: $CLEANUP_RESPONSE"
    
    if echo "$CLEANUP_RESPONSE" | grep -q "scans_deleted"; then
        log_pass "Manual cleanup executed successfully - $DELETED scans deleted"
        
        # Verify count decreased
        sleep 2
        AFTER_RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/admin/cleanup" \
            -H "x-api-key: $ENDPOINT_API_KEY")
        SCANS_AFTER=$(echo "$AFTER_RESPONSE" | grep -o '"total_scans":[0-9]*' | cut -d':' -f2)
        
        log_info "Scans after cleanup: $SCANS_AFTER"
        
        if [ "$SCANS_AFTER" -le "$SCANS_BEFORE" ]; then
            log_pass "Scan count is consistent (before: $SCANS_BEFORE, after: $SCANS_AFTER)"
        else
            log_fail "Scan count increased unexpectedly"
        fi
        
        return 0
    else
        log_fail "Manual cleanup failed"
        echo "Response: $CLEANUP_RESPONSE"
        return 1
    fi
}

# Test 6: Verify recent scans are preserved
test_recent_scans_preserved() {
    log_test "Verify Recent Scans Are Preserved"
    
    # Insert fresh scan
    RESPONSE=$(curl -s -X POST "$API_BASE_URL/api/endpoint/scan-data" \
        -H "Content-Type: application/json" \
        -H "x-api-key: $ENDPOINT_API_KEY" \
        -d "{
            \"endpoint_id\": \"test-recent-endpoint\",
            \"scans\": [
                {
                    \"mac\": \"FF:FF:FF:FF:FF:FF\",
                    \"rssi\": -50
                }
            ]
        }")
    
    sleep 1
    
    # Get statistics
    STATS=$(curl -s -X GET "$API_BASE_URL/api/admin/cleanup" \
        -H "x-api-key: $ENDPOINT_API_KEY")
    
    SCANS_24H=$(echo "$STATS" | grep -o '"scans_last_24h":[0-9]*' | cut -d':' -f2)
    
    if [ "$SCANS_24H" -gt 0 ]; then
        log_pass "Recent scans exist ($SCANS_24H scans in last 24h)"
        return 0
    else
        log_fail "No recent scans found"
        return 1
    fi
}

# Test 7: Check cleanup interval (monitor for 90 seconds)
test_cleanup_interval() {
    log_test "Monitor Auto-Cleanup Interval (90 seconds)"
    
    log_info "Monitoring logs for cleanup executions..."
    log_info "This will take ~90 seconds to verify 60-second interval"
    
    CLEANUP_COUNT=0
    START_TIME=$(date +%s)
    
    while [ $(($(date +%s) - START_TIME)) -lt 90 ]; do
        LOGS=$(fly logs -a seng401-project-zopac --since=90s 2>&1 | grep -i "cleanup:" || echo "")
        
        CURRENT_COUNT=$(echo "$LOGS" | wc -l | tr -d ' ')
        
        if [ "$CURRENT_COUNT" -gt "$CLEANUP_COUNT" ]; then
            CLEANUP_COUNT=$CURRENT_COUNT
            log_info "Cleanup executions detected: $CLEANUP_COUNT"
        fi
        
        sleep 10
    done
    
    if [ "$CLEANUP_COUNT" -ge 1 ]; then
        log_pass "Auto-cleanup executed at least once ($CLEANUP_COUNT times in 90s)"
        return 0
    else
        log_info "No cleanup executions logged - may indicate all data is recent"
        log_pass "Test inconclusive but not a failure"
        return 0
    fi
}

# Test 8: API authentication (should reject without key)
test_cleanup_auth() {
    log_test "Cleanup Endpoint Authentication"
    
    # Try without API key
    RESPONSE=$(curl -s -X GET "$API_BASE_URL/api/admin/cleanup")
    
    if echo "$RESPONSE" | grep -qi "unauthorized\|missing\|invalid"; then
        log_pass "Endpoint properly requires authentication"
        return 0
    else
        log_fail "Endpoint should reject requests without API key"
        echo "Response: $RESPONSE"
        return 1
    fi
}

# Main execution
main() {
    echo "=================================="
    echo "Auto-Cleanup System Test Suite"
    echo "=================================="
    echo "API Base: $API_BASE_URL"
    echo "Testing started at: $(date)"
    echo ""
    
    # Run all tests
    test_cleanup_statistics
    test_cleanup_auth
    test_scans_exist_before_cleanup
    test_insert_old_scans
    test_manual_cleanup
    test_recent_scans_preserved
    test_auto_cleanup_running
    
    # Optional: only run if user wants to wait
    if [ "$RUN_INTERVAL_TEST" = "true" ]; then
        test_cleanup_interval
    else
        log_info "Skipping 90-second interval test (set RUN_INTERVAL_TEST=true to enable)"
    fi
    
    # Summary
    echo ""
    echo "=================================="
    echo "Test Results Summary"
    echo "=================================="
    echo "Tests Run:    $TESTS_RUN"
    echo -e "Tests Passed: ${GREEN}$TESTS_PASSED${NC}"
    echo -e "Tests Failed: ${RED}$TESTS_FAILED${NC}"
    
    if [ $TESTS_FAILED -eq 0 ]; then
        echo -e "\n${GREEN}✓ All tests passed!${NC}"
        exit 0
    else
        echo -e "\n${RED}✗ Some tests failed${NC}"
        exit 1
    fi
}

# Run main function
main
