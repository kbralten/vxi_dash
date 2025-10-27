# E2E Test Suite

## Overview

This directory contains end-to-end (E2E) tests that validate the complete workflow of the VXI-11 Dashboard application, from instrument creation to data collection.

## Test Files

### `test_e2e_flow.py`

Comprehensive E2E tests that exercise the full application stack with file-based JSON storage.

#### Test Cases

1. **`test_complete_e2e_workflow`** - Complete instrument lifecycle test
   - Creates an instrument with advanced configuration (signals, modes, signal-mode matrix)
   - Validates configuration storage in JSON format
   - Creates a monitoring setup linked to the instrument
   - Simulates VXI-11 connection to mock instrument
   - Collects data for multiple signals using configured commands
   - Tests mode switching (standby → run → diagnostic)
   - Validates unit scaling configuration (V → mV, A → mA, W → mW)
   - **What it tests:**
     - Full 4-step instrument configuration workflow
     - JSON serialization/deserialization of complex configs
     - Monitoring setup creation with parameters
     - VXI-11 client command execution
     - Mode parameter substitution (`{param}` syntax)
     - Signal-mode matrix unit/scaling application

2. **`test_multiple_instruments_monitoring`** - Multi-instrument coordination
   - Creates two different instruments with unique configurations
   - Creates separate monitoring setups for each instrument
   - Validates instrument data enrichment in monitoring responses
   - Tests list operations returning all setups
   - **What it tests:**
     - Concurrent management of multiple instruments
     - Foreign key relationships (monitoring → instrument)
     - Data enrichment in API responses
     - Isolation between different monitoring configurations

3. **`test_instrument_validation_and_crud`** - Full CRUD operations
   - Create: Adds new instrument with configuration
   - Read: Retrieves instrument by ID
   - Update: Modifies instrument name, address, and active status
   - Delete: Removes instrument from storage
   - Validates unique name constraint enforcement
   - Tests 404 handling for non-existent instruments
   - **What it tests:**
     - All CRUD endpoints (POST, GET, PUT, DELETE)
     - File-based storage persistence
     - Unique constraint validation
     - Proper HTTP status codes (201, 200, 400, 404, 204)
     - Data integrity after updates

4. **`test_monitoring_with_real_mock_service`** - Integration with mock instrument service
   - Connects to the actual mock instrument Docker service
   - Validates HTTP communication with mock service
   - Tests realistic network-based instrument interaction
   - Skips gracefully if mock service unavailable
   - **What it tests:**
     - Docker service-to-service communication
     - HTTP client integration
     - Real network request/response handling
     - Graceful degradation with pytest.skip()

## Running the Tests

### Run all E2E tests:
```bash
docker-compose run --rm backend poetry run pytest tests/test_e2e_flow.py -v
```

### Run a specific test:
```bash
docker-compose run --rm backend poetry run pytest tests/test_e2e_flow.py::test_complete_e2e_workflow -v
```

### Run with detailed output:
```bash
docker-compose run --rm backend poetry run pytest tests/test_e2e_flow.py -v -s
```

## Test Architecture

### File-Based Storage

All tests use the `FileStorage` class which persists data to JSON files:
- `data/instruments.json` - Instrument configurations
- `data/monitoring.json` - Monitoring setup configurations

The `clean_storage` fixture automatically clears these files before and after each test to ensure test isolation.

### Mock VXI-11 Client

The `VXI11Client` class simulates instrument communication:
- `query(command)` - Sends a query command and returns mock response
- `write(command, parameters)` - Sends a write command with optional parameters

This allows testing without requiring actual VXI-11 hardware.

### Test Data Structure

Instruments are created with comprehensive configurations:

```json
{
  "signal": {
    "voltage": "MEAS:VOLT?",
    "current": "MEAS:CURR?"
  },
  "mode": {
    "run": {
      "enable": "MODE RUN {frequency}",
      "disable": "MODE STOP",
      "parameters": ["frequency"]
    }
  },
  "signal_mode_config": {
    "voltage": {
      "run": {"unit": "V", "scale": 1.0}
    }
  }
}
```

This configuration is stored in the instrument's `description` field as JSON.

## What the Tests Validate

✅ **Instrument Management:**
- Creation with complex JSON configurations
- Unique name validation
- Update operations preserving IDs
- Soft delete functionality
- List operations with filtering

✅ **Monitoring Setup:**
- Creation with foreign key to instruments
- Parameter storage in JSON format
- Frequency configuration
- Automatic instrument data enrichment
- Cascading operations

✅ **VXI-11 Communication:**
- Command generation from configuration
- Parameter substitution in mode commands
- Query/write operations
- Response handling
- Mode switching

✅ **Configuration Matrix:**
- Signal definitions with commands
- Mode definitions with parameters
- Signal-mode unit/scaling relationships
- Dynamic parameter replacement

✅ **File-Based Storage:**
- JSON persistence
- Auto-ID generation
- Data integrity
- Concurrent access safety
- Pretty-printed output for hand-editing

## Dependencies

- `pytest` - Test framework
- `pytest-asyncio` - Async test support
- `httpx` - HTTP client for API testing
- FastAPI `TestClient` - API endpoint testing
- `FileStorage` - JSON file-based persistence

## Continuous Integration

These tests should be run as part of CI/CD pipeline to ensure:
1. All CRUD operations work correctly
2. File-based storage is reliable
3. VXI-11 client integration functions
4. Configuration serialization/deserialization works
5. Multi-instrument scenarios are handled
6. API contracts are maintained (status codes, response formats)

## Future Test Additions

Consider adding tests for:
- Concurrent write operations to JSON files
- Large-scale instrument collections (performance)
- Invalid configuration handling
- Network timeout scenarios
- Malformed JSON recovery
- Data migration/backup operations
