# State Machine Engine - Implementation Summary

## Overview

The state machine engine is now implemented as a standalone backend service that manages automated workflows for monitoring setups. This completes **Milestone 2** from the development plan.

## Architecture

### Core Components

1. **`StateMachineSession`** - Represents a single running state machine instance
   - Manages current state and timing
   - Evaluates transition rules
   - Applies instrument settings
   - Handles initial and end states

2. **`StateMachineEngine`** - Singleton service managing all sessions
   - Creates and destroys sessions
   - Provides status information
   - Coordinates with data collector

3. **API Routes** (`/api/state-machine/*`)
   - `POST /{setup_id}/start` - Start a state machine
   - `POST /{setup_id}/stop` - Stop a running state machine
   - `GET /{setup_id}/status` - Get current status
   - `GET /` - List all active sessions

## Key Features

### State Management

- **Initial State**: Defined by `initialStateID` field on the monitoring setup
- **End States**: States with `isEndState: true` automatically stop the session
- **State Transitions**: Automatic when all rules are satisfied

### Rule Evaluation (Tick Loop)

The engine runs at 1 Hz (configurable) and evaluates three rule types:

1. **Sensor Rules** (`type: "sensor"`)
   ```typescript
   {
     type: "sensor",
     signalName: "DMM: Voltage",
     operator: ">",  // >, <, >=, <=, ==, !=
     value: 4.19
   }
   ```

2. **Time in State Rules** (`type: "timeInState"`)
   ```typescript
   {
     type: "timeInState",
     seconds: 30
   }
   ```

3. **Total Time Rules** (`type: "totalTime"`)
   ```typescript
   {
     type: "totalTime",
     seconds: 3600
   }
   ```

### Instrument Control

When transitioning to a new state, the engine:
1. Looks up `instrumentSettings` in the state definition
2. For each instrument, finds the specified mode
3. Executes the mode's `enableCommands` with parameters
4. Applies parameter substitution (e.g., `{volts}` → `4.2`)

### Integration with Data Collector

- Starts monitoring when state machine starts
- Uses latest readings for sensor rule evaluation
- Stops monitoring when state machine stops
- Disables instrument modes on stop

## API Usage Examples

### Start a State Machine

```bash
POST /api/state-machine/{setup_id}/start
```

Response:
```json
{
  "message": "State machine started",
  "status": {
    "setup_id": 1,
    "is_running": true,
    "current_state_id": "state_init",
    "session_started_at": "2025-10-28T10:30:00.000Z",
    "state_entered_at": "2025-10-28T10:30:00.000Z",
    "time_in_current_state": 0.0,
    "total_session_time": 0.0
  }
}
```

### Check Status

```bash
GET /api/state-machine/{setup_id}/status
```

Response:
```json
{
  "setup_id": 1,
  "is_running": true,
  "current_state_id": "state_charging",
  "session_started_at": "2025-10-28T10:30:00.000Z",
  "state_entered_at": "2025-10-28T10:30:15.000Z",
  "time_in_current_state": 45.2,
  "total_session_time": 60.2
}
```

### Stop a State Machine

```bash
POST /api/state-machine/{setup_id}/stop
```

Response:
```json
{
  "message": "State machine stopped",
  "setup_id": 1
}
```

### List All Sessions

```bash
GET /api/state-machine/
```

Response:
```json
[
  {
    "setup_id": 1,
    "is_running": true,
    "current_state_id": "state_charging",
    ...
  },
  {
    "setup_id": 2,
    "is_running": true,
    "current_state_id": "state_soak",
    ...
  }
]
```

## Data Model Changes

### MonitoringSetup Structure

```typescript
{
  id: number,
  name: string,
  instruments: [...],
  frequency_hz: number,
  
  // State machine fields
  initialStateID: string,        // References the starting state
  states: State[],               // Array of state definitions
  transitions: Transition[]      // Array of transition definitions
}
```

### State Structure

```typescript
{
  id: string,                    // Unique identifier
  name: string,                  // Display name
  isEndState: boolean,           // If true, stops session when reached
  
  instrumentSettings: {
    [instrument_id: string]: {
      modeId?: string,           // Mode to activate
      modeName?: string,         // Alternative: mode name
      modeParams: {              // Parameters for the mode
        [key: string]: any
      }
    }
  }
}
```

Note: `isInitialState` was removed from states. Use `initialStateID` on the setup instead.

### Transition Structure

```typescript
{
  id: string,
  sourceStateID: string,         // State this transition leaves
  targetStateID: string,         // State this transition enters
  rules: Rule[]                  // All must be satisfied (AND logic)
}
```

## Example: Battery Charge/Discharge Test

```json
{
  "id": 1,
  "name": "Battery Test",
  "initialStateID": "init",
  "states": [
    {
      "id": "init",
      "name": "Initial Setup",
      "isEndState": false,
      "instrumentSettings": {
        "1": {
          "modeName": "Set Output",
          "modeParams": { "volts": 0, "amps": 0 }
        }
      }
    },
    {
      "id": "charging",
      "name": "Charging",
      "isEndState": false,
      "instrumentSettings": {
        "1": {
          "modeName": "Set Output",
          "modeParams": { "volts": 4.2, "amps": 1.0 }
        }
      }
    },
    {
      "id": "complete",
      "name": "Test Complete",
      "isEndState": true,
      "instrumentSettings": {
        "1": {
          "modeName": "Off",
          "modeParams": {}
        }
      }
    }
  ],
  "transitions": [
    {
      "id": "init_to_charging",
      "sourceStateID": "init",
      "targetStateID": "charging",
      "rules": [
        { "type": "timeInState", "seconds": 5 }
      ]
    },
    {
      "id": "charging_to_complete",
      "sourceStateID": "charging",
      "targetStateID": "complete",
      "rules": [
        {
          "type": "sensor",
          "signalName": "DMM: Voltage",
          "operator": ">=",
          "value": 4.19
        }
      ]
    }
  ]
}
```

## Workflow

1. **User creates a monitoring setup** with states and transitions
2. **User calls** `POST /api/state-machine/{setup_id}/start`
3. **Engine loads** the setup and validates initial state
4. **Engine transitions** to initial state and applies settings
5. **Engine starts** data monitoring at configured frequency
6. **Engine ticks** at 1 Hz, evaluating transition rules
7. **When rules satisfied**, engine transitions to target state
8. **If end state reached**, engine automatically stops
9. **User can call** `POST /api/state-machine/{setup_id}/stop` anytime

## Next Steps (Future Milestones)

- **Milestone 3**: Basic State Configuration UI
- **Milestone 4**: Visual Node Editor (Canvas)
- **Milestone 5**: Transition Creation (Linking Nodes)
- **Milestone 6**: Transition Rule Modal (UI)
- **Milestone 7**: Enhanced Rule Evaluation (already done in engine)
- **Milestone 8**: Special States UI (initial/end markers)
- **Milestone 9**: Live Visualization (highlight active state)
- **Milestone 10**: Validation & Error Handling

## Testing

The engine can be tested using curl or any HTTP client:

```bash
# Start a state machine
curl -X POST http://localhost:8000/api/state-machine/1/start

# Check status
curl http://localhost:8000/api/state-machine/1/status

# Stop
curl -X POST http://localhost:8000/api/state-machine/1/stop
```

## Files Modified/Created

### New Files
- `backend/app/services/state_machine_engine.py` - Core engine implementation
- `backend/app/api/routes/state_machine.py` - API routes

### Modified Files
- `backend/app/models/state_machine.py` - Removed `isInitialState` from State
- `backend/app/main.py` - Added state machine router
- `backend/app/api/routes/__init__.py` - Exported state machine router
