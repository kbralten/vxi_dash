# State Machine User Guide

## Quick Start: Creating and Running State Machines

### 1. Create a Monitoring Setup with State Machine

1. Navigate to **Monitoring** tab
2. Click **"New Monitoring Setup"**
3. Fill in basic details:
   - **Name**: e.g., "Temperature Control Test"
   - **Instrument**: Select your VXI-11 instrument
   - **Mode**: Choose instrument mode for data collection
   - **Collection Interval**: Set reading frequency (e.g., 1 second)

4. **Add States** (Click "Add State" for each):
   - **Idle State**:
     - Name: "Idle"
     - Configure instrument settings (e.g., turn off heater)
   
   - **Heating State**:
     - Name: "Heating"
     - Configure instrument settings (e.g., heater on, 100W)
   
   - **Cooling State**:
     - Name: "Cooling"
     - Configure instrument settings (e.g., heater off, fan on)
   
   - **Complete State**:
     - Name: "Complete"
     - Check "End State" (stops execution when reached)

5. **Add Transitions** (Drag from one state to another):
   - **Idle → Heating**:
     - Click the arrow to edit rules
     - Add rule: `timeInState >= 5` (wait 5 seconds)
   
   - **Heating → Cooling**:
     - Add rule: `temperature > 75.0` (when too hot)
   
   - **Cooling → Complete**:
     - Add rule: `temperature < 60.0` (when cool enough)

6. **Set Initial State**: Click "Set as Initial" on the Idle state

7. Click **"Create Setup"**

### 2. Start the State Machine

1. Find your setup in the monitoring list
2. You'll see a **"State Machine Enabled"** badge showing:
   - Number of states
   - Number of transitions
   - Initial state name

3. Click **"Start SM"** button
   - The state machine starts in the initial state
   - Instrument settings are applied automatically
   - Status updates every 2 seconds

### 3. Monitor Execution

Watch the state machine run automatically:

- **Running Indicator**: Green pulsing dot when active
- **Current State**: Highlighted in blue
- **Time in State**: Live counter showing seconds in current state

The backend evaluates rules **every second** and automatically transitions when conditions are met.

### 4. Stop the State Machine

Click **"Stop SM"** button to stop execution:
- State machine loop stops
- Data collection stops
- Instrument modes disabled

---

## Rule Types Explained

### Sensor Rules
Compare instrument readings against thresholds.

**Format:**
```
IF {signalName} {operator} {value}
```

**Example:**
```
IF temperature > 75.0
IF pressure <= 100.0
IF voltage == 5.0
```

**Operators:**
- `>` - Greater than
- `<` - Less than
- `>=` - Greater than or equal
- `<=` - Less than or equal
- `==` - Equal to
- `!=` - Not equal to

**When to use:**
- React to sensor readings (temperature, voltage, etc.)
- Implement feedback control loops
- Safety thresholds

### Time in State Rules
Trigger after spending time in current state.

**Format:**
```
AFTER {seconds} seconds in current state
```

**Example:**
```
AFTER 10 seconds in current state
AFTER 0.5 seconds in current state
AFTER 300 seconds in current state (5 minutes)
```

**When to use:**
- Minimum dwell time in states
- Timed sequences (heat for X seconds)
- Timeout conditions

### Total Time Rules
Trigger based on total session runtime.

**Format:**
```
IF total session time >= {seconds} seconds
```

**Example:**
```
IF total session time >= 60 seconds (1 minute)
IF total session time >= 3600 seconds (1 hour)
```

**When to use:**
- Overall test duration limits
- Maximum runtime enforcement
- Time-based test phases

---

## Multi-Rule Transitions (AND Logic)

You can add **multiple rules** to a single transition. All rules must be satisfied for the transition to occur.

**Example:**
```
Transition: Heating → Cooling
Rules:
  1. temperature > 75.0
  2. timeInState >= 30
```

This transition only fires when:
- Temperature exceeds 75°C **AND**
- The state has been active for at least 30 seconds

**Use cases:**
- "Heat for at least 30 seconds OR until temperature reaches 75°C" → Use TWO transitions
- "Heat for 30 seconds AND temperature must reach 75°C" → Use ONE transition with TWO rules

---

## Common Patterns

### Pattern 1: Sequential Timed Workflow
```
State A (5s) → State B (10s) → State C (End)

Transition A→B: timeInState >= 5
Transition B→C: timeInState >= 10
```

### Pattern 2: Temperature Control Loop
```
Idle → Heating → Cooling → Complete

Idle→Heating: timeInState >= 2
Heating→Cooling: temperature > 75.0
Cooling→Complete: temperature < 60.0
```

### Pattern 3: Safety Timeout
```
Normal Operation → Emergency Stop

Normal→Emergency: totalTime >= 300 (5 min max)
Normal→Emergency: pressure > 150 (safety limit)
```

### Pattern 4: Feedback Control
```
Heating ⇄ Cooling (oscillate to maintain temperature)

Heating→Cooling: temperature > 72.0
Cooling→Heating: temperature < 68.0

(Maintains temperature between 68-72°C)
```

### Pattern 5: Multi-Phase Test
```
Initialize (2s) → Ramp Up (until 100°C) → Hold (60s) → Ramp Down (until 30°C) → Complete

Initialize→RampUp: timeInState >= 2
RampUp→Hold: temperature >= 100.0
Hold→RampDown: timeInState >= 60
RampDown→Complete: temperature <= 30.0
```

---

## Tips & Best Practices

### State Design
- **Keep states simple**: Each state = one instrument configuration
- **Name clearly**: Use descriptive names (not "State 1", "State 2")
- **Mark end states**: Always mark completion states as "End State"
- **Initial state**: Always set an initial state before starting

### Transition Design
- **Avoid conflicts**: Don't create multiple transitions from same state with overlapping rules
- **Test incrementally**: Start with 2-3 states, add complexity gradually
- **Use timeInState for stability**: Add minimum dwell time to prevent rapid oscillations
- **Combine rule types**: Mix sensor and time rules for robust behavior

### Rule Design
- **Sensor rules**: Use appropriate operators and realistic thresholds
- **Time rules**: Account for data collection frequency (1-second minimum is typical)
- **Multi-rule AND**: Remember all rules must be true simultaneously
- **Safety margins**: Add buffer to thresholds (e.g., 74°C instead of 75°C for faster response)

### Testing
1. **Dry run**: Test with short timeouts first (2-5 seconds)
2. **Watch the UI**: Monitor current state and timing
3. **Check transitions**: Verify transitions occur at expected times/values
4. **End state**: Confirm state machine stops at end state
5. **Scale up**: Once working, increase timeouts to production values

### Debugging
- **State not transitioning?**
  - Check all rules are satisfied (AND logic)
  - Verify signal names match exactly
  - Check threshold values are realistic
  
- **Transitions too fast?**
  - Add `timeInState >= X` rule for minimum dwell
  - Increase data collection interval
  
- **Wrong initial state?**
  - Click "Set as Initial" on correct state
  - Verify badge shows correct initial state name
  
- **State machine won't start?**
  - Ensure initial state is set
  - Check that at least one state exists
  - Verify instrument is configured correctly

---

## Example: Complete Temperature Cycling Test

**Goal**: Heat instrument to 80°C, hold for 30 seconds, cool to 40°C, repeat 3 times

**States:**
1. **Start** (Initial, End after setup)
   - Instrument: All off
   - Transition: `timeInState >= 2` → Heating1

2. **Heating1** (First heat cycle)
   - Instrument: Heater on, 100W
   - Transition: `temperature >= 80.0` → Hold1

3. **Hold1** (Hold at temperature)
   - Instrument: Heater on, 50W (maintain)
   - Transition: `timeInState >= 30` → Cooling1

4. **Cooling1** (First cool cycle)
   - Instrument: Heater off, fan on
   - Transition: `temperature <= 40.0` → Heating2

5. **Heating2** (Second heat cycle)
   - Instrument: Heater on, 100W
   - Transition: `temperature >= 80.0` → Hold2

6. **Hold2**
   - Instrument: Heater on, 50W
   - Transition: `timeInState >= 30` → Cooling2

7. **Cooling2**
   - Instrument: Heater off, fan on
   - Transition: `temperature <= 40.0` → Heating3

8. **Heating3** (Third heat cycle)
   - Instrument: Heater on, 100W
   - Transition: `temperature >= 80.0` → Hold3

9. **Hold3**
   - Instrument: Heater on, 50W
   - Transition: `timeInState >= 30` → Cooling3

10. **Cooling3**
    - Instrument: Heater off, fan on
    - Transition: `temperature <= 40.0` → Complete

11. **Complete** (End State)
    - Instrument: All off

**Estimated Runtime**: ~15-20 minutes depending on heating/cooling rates

---

## Limitations

### Current Limitations
1. **No OR logic**: All rules in a transition must be true (cannot do "rule1 OR rule2")
2. **Fixed tick rate**: Evaluates rules every 1 second (not configurable)
3. **No manual transitions**: Cannot force a state change once running
4. **No transition logging**: State changes aren't recorded in data export
5. **End state final**: Cannot restart from end state without stopping and restarting

### Workarounds
- **Want OR logic?**: Create multiple transitions (one per condition)
- **Need faster evaluation?**: Not currently possible, contact developers
- **Need manual control?**: Stop state machine, manually change instrument, restart
- **Want transition history?**: Monitor UI during run, take screenshots

---

## Troubleshooting

### "Failed to start state machine"
**Cause**: No valid initial state
**Solution**: Click "Set as Initial" on a state, save setup, try again

### State machine stops immediately
**Cause**: Initial state is marked as "End State"
**Solution**: Uncheck "End State" on initial state OR choose different initial state

### Transitions not firing
**Cause**: Rules not satisfied or conflicting transitions
**Solution**:
1. Check sensor values in dashboard (are they reaching threshold?)
2. Check time values (is timeout long enough?)
3. Check all rules in AND group are true
4. Remove other transitions from same state temporarily

### UI shows wrong current state
**Cause**: Polling delay (2 seconds)
**Solution**: Wait 2-3 seconds for UI to refresh, check backend logs for actual state

### Cannot edit running state machine
**Cause**: Must stop before editing
**Solution**: Click "Stop SM", then "Edit"

---

**Happy state machine building! 🎛️**
