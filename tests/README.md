# Automated Test Suite - Sprint 5

## Overview
This directory contains automated black-box tests for the ZOPAC Indoor Positioning System.

## Test Structure
- `api/` - API endpoint tests (Postman/curl-based)
- `integration/` - End-to-end integration tests
- `accuracy/` - System accuracy evaluation tests

## Running Tests

### Prerequisites
```bash
# Ensure system is running
docker-compose up -d

# Verify services are healthy
docker-compose ps
```

### API Tests
```bash
cd tests/api
./run-api-tests.sh
```

### Integration Tests
```bash
cd tests/integration
npm test
```

## Test Coverage
Tests cover the following core features:
- Endpoint data transmission (US #XX)
- Localization algorithm (US #XX)
- Client authentication (US #XX)
- Endpoint status monitoring (US #XX)
- Floorplan management (US #XX)
- Heatmap visualization (US #XX)

## Bug Reporting
When tests fail, create a GitHub Issue with:
- Bug label
- Sprint 5 milestone
- Reference to failing test case ID
- Copy of test failure output
