# State Machine Test Suite

## Overview

Comprehensive test suite for the state machine engine, validating all key behaviors including state management, rule evaluation, transitions, and complete workflows.

## Test Results

**✅ All 27 state machine tests passing**

```
27 passed in 1.09s
```

## Test Coverage

### 1. StateMachineSession Tests (17 tests)

#### Setup and Configuration
- ✅ `test_load_setup_success` - Validates successful loading of monitoring setup with states and transitions
- ✅ `test_load_setup_no_states` - Ensures load fails gracefully when setup has no states
- ✅ `test_get_initial_state_id` - Verifies retrieval of initial state from setup
- ✅ `test_is_end_state` - Tests identification of end states vs regular states

#### State Behavior
- ✅ `test_apply_state_settings` - Validates instrument settings are applied when entering a state
- ✅ `test_transition_to_state` - Tests transitioning to a new state updates current state and applies settings
- ✅ `test_transition_to_end_state_stops_session` - Ensures reaching an end state automatically stops the session

#### Rule Evaluation
- ✅ `test_evaluate_time_in_state_rule` - Tests time-in-state rules trigger after specified duration
- ✅ `test_evaluate_total_time_rule` - Tests total-time rules trigger after total session duration
- ✅ `test_evaluate_sensor_rule` - Tests all sensor comparison operators (>, <, >=, <=, ==, !=)

#### Transition Logic
- ✅ `test_check_transitions_no_match` - Validates no transition occurs when rules not satisfied
- ✅ `test_check_transitions_match` - Validates transition occurs when all rules satisfied

#### Session Lifecycle
- ✅ `test_start_session_success` - Tests successful session start from initial state
- ✅ `test_start_session_no_initial_state` - Ensures start fails when no initial state defined
- ✅ `test_start_session_invalid_initial_state` - Ensures start fails when initial state doesn't exist
- ✅ `test_stop_session` - Tests session stop disables monitoring and instruments
- ✅ `test_get_status` - Validates status reporting includes all relevant information

### 2. StateMachineEngine Tests (8 tests)

#### Session Management
- ✅ `test_start_session` - Tests starting a new session via engine
- ✅ `test_start_session_replaces_existing` - Ensures starting a new session stops any existing session for that setup
- ✅ `test_stop_session` - Tests stopping a session via engine
- ✅ `test_stop_nonexistent_session` - Tests stopping nonexistent session returns false

#### Status Tracking
- ✅ `test_get_session_status` - Tests getting status of active session
- ✅ `test_get_session_status_nonexistent` - Tests getting status of nonexistent session returns None
- ✅ `test_get_all_sessions_status` - Tests getting status of all active sessions
- ✅ `test_stop_all_sessions` - Tests stopping all sessions clears session map

### 3. Integration Tests (2 tests)

#### Complete Workflows
- ✅ `test_complete_workflow` - Tests full workflow from initial state through transitions to end state
  - Starts in initial state
  - Time-based transition to running state
  - Sensor-based transition to complete (end) state
  - Automatic stop on reaching end state

- ✅ `test_multi_rule_transition` - Tests transitions with multiple rules using AND logic
  - Validates that all rules must be satisfied
  - Tests combination of sensor and time-in-state rules

## Test Fixtures

### `mock_storage`
Provides a complete monitoring setup with:
- 3 states: init, running, complete (end state)
- 2 transitions with different rule types
- Mock instrument with modes and signals

### `mock_vxi11_client`
Mock VXI-11 client for testing instrument commands without hardware

### `mock_data_collector`
Mock data collector for testing integration without actual monitoring

## Key Test Scenarios

### 1. Entering a State
Tests validate that entering a state:
- Updates current state ID
- Sets state entry timestamp
- Applies instrument settings from state definition
- Sends correct SCPI commands to instruments

### 2. Starting from Initial State
Tests validate that starting a session:
- Loads the setup configuration
- Validates initial state exists
- Transitions to initial state
- Starts data monitoring
- Initializes session timing

### 3. Triggering a State Change
Tests validate that transitions occur when:
- All rules in a transition are satisfied (AND logic)
- Rules are evaluated correctly:
  - Sensor rules compare against latest readings
  - Time-in-state rules check duration in current state
  - Total-time rules check total session duration

### 4. Reaching an End State
Tests validate that reaching an end state:
- Automatically calls `stop()`
- Sets `is_running` to false
- Stops data monitoring
- Disables instrument modes

## Rule Type Coverage

### Sensor Rules
- Operator: `>` (greater than)
- Operator: `<` (less than)
- Operator: `>=` (greater than or equal)
- Operator: `<=` (less than or equal)
- Operator: `==` (equal)
- Operator: `!=` (not equal)

### Time Rules
- `timeInState`: Duration in current state
- `totalTime`: Total session duration

### Multi-Rule Logic
- AND logic: All rules must be satisfied
- Validates proper evaluation order

## Error Handling Coverage

- ✅ No initial state defined
- ✅ Invalid initial state ID
- ✅ Empty state list
- ✅ Nonexistent session operations
- ✅ Multiple session management

## Running the Tests

### All State Machine Tests
```bash
docker compose run --rm backend poetry run pytest tests/test_state_machine.py -v
```

### Specific Test Class
```bash
docker compose run --rm backend poetry run pytest tests/test_state_machine.py::TestStateMachineSession -v
```

### Single Test
```bash
docker compose run --rm backend poetry run pytest tests/test_state_machine.py::TestStateMachineSession::test_start_session_success -v
```

### With Coverage
```bash
docker compose run --rm backend poetry run pytest tests/test_state_machine.py --cov=app.services.state_machine_engine
```

## Test Structure

Tests are organized into three classes:

1. **TestStateMachineSession** - Unit tests for session behavior
2. **TestStateMachineEngine** - Unit tests for engine management
3. **TestStateMachineIntegration** - Integration tests for complete workflows

All tests use pytest's async support via `@pytest.mark.asyncio` decorator.

## Mock Strategy

- **Storage**: Mocked to provide test data without file I/O
- **VXI-11 Client**: Mocked to test instrument commands without hardware
- **Data Collector**: Mocked to test integration without actual monitoring

This allows tests to run fast and reliably without external dependencies.
