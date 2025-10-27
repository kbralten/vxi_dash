# Interactive Instrument Terminal - Implementation Summary

## Overview
Implemented a comprehensive interactive terminal interface for real-time instrument control and SCPI command execution.

## Features Implemented

### 1. Interactive Tab in Navigation
- Added "Interactive" tab to the main navigation bar
- Tab switching between Dashboard, Instruments, Monitoring, and Interactive views
- Updated App.tsx to include the new view type

### 2. Instrument Selector
- Dropdown to select from active instruments
- Displays instrument name and address
- Automatically selects first active instrument
- Shows message if no active instruments available

### 3. SCPI Command Terminal (`CommandTerminal.tsx`)
**Features:**
- **Real-time command execution** - Send SCPI commands and see responses immediately
- **Command history** - Navigate previous commands using ↑/↓ arrow keys
- **Timestamped output** - Each command and response shows execution time
- **Color-coded display:**
  - Commands in emerald green with `>` prompt
  - Responses in white
  - Errors in red
- **Auto-scroll** - Terminal automatically scrolls to show latest output
- **Clear function** - Button to clear terminal history
- **Connection status** - Shows connected instrument at top
- **Loading states** - Visual feedback while commands execute

**Terminal Interface:**
```
SCPI Command Terminal                              [Clear]
────────────────────────────────────────────────────────
19:23:45 Connected to Test Power Supply (192.168.1.100:1024/inst0)
19:23:50 > *IDN?
19:23:50 Mock response from 192.168.1.100:1024 to '*IDN?'
19:24:00 > MEAS:VOLT?
19:24:00 Mock response from 192.168.1.100:1024 to 'MEAS:VOLT?'
────────────────────────────────────────────────────────
> [Enter SCPI command...]                         [Send]
Tip: Use ↑/↓ arrow keys to navigate command history
```

### 4. Mode Control Panel (`ModeControl.tsx`)
**Features:**
- **Automatic mode detection** - Parses instrument configuration to display all available modes
- **Start/Stop buttons** - Control each mode independently
- **Active mode tracking** - Visual indication of currently active mode
- **Parameter support** - Prompts for parameters when starting modes that require them
- **Command preview** - Shows enable/disable commands for each mode
- **Visual feedback:**
  - Active modes highlighted in emerald green
  - Inactive modes in dark slate
  - Disabled buttons when mode is already active/inactive
  - Loading states during command execution

**Mode Display:**
```
Mode Control
────────────────────────────────────────────────────────
Active Mode: run

┌─ standby ───────────────────────────────────────────┐
│ Parameters: (none)                                   │
│ Enable: MODE STANDBY                                 │
│ Disable: MODE OFF                           [Start] [Stop] │
└──────────────────────────────────────────────────────┘

┌─ run ────────────────────────────────────────────────┐ ← Active
│ Parameters: frequency                                │
│ Enable: MODE RUN {frequency}                         │
│ Disable: MODE STOP                          [Start] [Stop] │
└──────────────────────────────────────────────────────┘

┌─ diagnostic ─────────────────────────────────────────┐
│ Parameters: level                                    │
│ Enable: MODE DIAG {level}                            │
│ Disable: MODE NORMAL                        [Start] [Stop] │
└──────────────────────────────────────────────────────┘
```

### 5. Mode Parameter Dialog (`ModeParameterDialog.tsx`)
**Features:**
- **Modal dialog** - Appears when starting a mode that requires parameters
- **Input validation** - Ensures all parameters are filled before submission
- **Auto-focus** - First parameter field automatically focused
- **Cancel option** - Dismiss dialog without executing command
- **Clear labeling** - Each parameter clearly identified

**Dialog Example:**
```
┌─────────────────────────────────────────────────────┐
│ Start Mode: run                                     │
│                                                      │
│ This mode requires the following parameters:        │
│                                                      │
│ frequency                                            │
│ ┌─────────────────────────────────────────────────┐ │
│ │ Enter frequency                                 │ │
│ └─────────────────────────────────────────────────┘ │
│                                                      │
│              [Cancel]         [Start Mode]           │
└─────────────────────────────────────────────────────┘
```

### 6. Backend API Endpoint
**Added to `backend/app/api/routes/instruments.py`:**

```python
POST /api/instruments/{instrument_id}/command
Request Body: { "command": "MEAS:VOLT?" }
Response: { "response": "12.3V" }
```

**Functionality:**
- Parses instrument address to get host
- Creates VXI-11 client connection
- Detects query commands (ending with `?`) vs write commands
- Returns response for queries
- Returns "OK" for write commands
- Proper error handling with HTTP 500 for communication failures

## Frontend Service Updates

**`frontend/src/services/instrumentService.ts`:**
- Added `getInstruments()` - Alias for fetchInstruments
- Added `sendCommand(instrumentId, command)` - Send SCPI commands to instruments

## Component Architecture

```
InteractiveTerminal (Main Container)
├── Instrument Selector (Dropdown)
├── CommandTerminal
│   ├── Terminal Output (Scrollable)
│   ├── Command Input
│   └── History Navigation
└── ModeControl
    ├── Mode List
    ├── Start/Stop Buttons
    └── ModeParameterDialog (Modal)
```

## User Workflow

1. **Navigate to Interactive Tab**
   - Click "Interactive" in main navigation

2. **Select Instrument**
   - Choose from dropdown of active instruments
   - Terminal automatically connects

3. **Send SCPI Commands**
   - Type command in terminal (e.g., `*IDN?` or `MEAS:VOLT?`)
   - Press Enter or click Send
   - View response in terminal
   - Use ↑/↓ to recall previous commands

4. **Control Modes**
   - View all available modes in Mode Control panel
   - Click "Start" to activate a mode
   - Enter parameters if required (modal dialog appears)
   - Click "Stop" to deactivate mode
   - Active mode shown at top of panel

## Technical Implementation Details

### State Management
- Uses React hooks (useState, useEffect, useRef)
- Separate state for active mode tracking
- Command history stored in component state
- Terminal auto-scroll using ref

### Error Handling
- Network errors displayed in terminal as red text
- Mode control shows errors in dedicated error banner
- HTTP error responses properly caught and displayed

### Styling
- Consistent with existing TailwindCSS theme
- Dark mode (slate-900/950 backgrounds)
- Primary color (emerald) for active states
- Red for errors, green for success states
- Monospace font for terminal output

### Performance
- Efficient rendering with React.memo potential
- No unnecessary re-renders
- Debounced command execution possible

## Files Created/Modified

**Created:**
- `frontend/src/components/interactive/InteractiveTerminal.tsx` - Main container
- `frontend/src/components/interactive/CommandTerminal.tsx` - SCPI terminal
- `frontend/src/components/interactive/ModeControl.tsx` - Mode control panel
- `frontend/src/components/interactive/ModeParameterDialog.tsx` - Parameter input modal

**Modified:**
- `frontend/src/App.tsx` - Added Interactive tab
- `frontend/src/services/instrumentService.ts` - Added sendCommand and getInstruments
- `backend/app/api/routes/instruments.py` - Added command endpoint

## Testing the Feature

1. Create an instrument with advanced configuration (signals and modes)
2. Navigate to Interactive tab
3. Select the instrument
4. Try SCPI commands:
   - `*IDN?` - Query instrument identity
   - `MEAS:VOLT?` - Query voltage
   - `MODE RUN` - Set run mode
5. Use Mode Control:
   - Click "Start" on a mode
   - Enter parameters if prompted
   - Observe active mode indicator
   - Click "Stop" to deactivate

## Future Enhancements

Possible additions:
- Command autocomplete
- Save/load command scripts
- Batch command execution
- Export terminal history
- Syntax highlighting for SCPI commands
- Command templates/favorites
- Multi-instrument simultaneous control
- Real-time signal monitoring graphs
- WebSocket support for continuous data streaming
