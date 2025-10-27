# Live Dashboard Implementation

## Overview
The Live Dashboard provides real-time visualization and historical data logging for VXI-11 instrument monitoring setups. It automatically collects data at configured frequencies, stores measurements, and displays trends through interactive charts and tables.

## Architecture

### Backend Components

#### 1. DataCollector Service (`backend/app/services/data_collector.py`)
Manages continuous data collection from monitoring setups.

**Key Features:**
- Asynchronous monitoring tasks using `asyncio`
- Configurable collection frequency per setup
- Automatic scaling of measurement values based on signal-mode configuration
- Data storage rotation (keeps last 10,000 readings)
- Error handling and recovery

**Main Methods:**
```python
async def collect_from_setup(setup_id: int) -> Optional[dict]
    # Collects single reading from a monitoring setup
    
async def monitor_setup(setup_id: int, frequency_hz: float)
    # Continuously monitors setup at specified frequency
    
def start_monitoring(setup_id: int, frequency_hz: float)
    # Starts background monitoring task
    
def stop_monitoring(setup_id: int)
    # Stops background monitoring task
```

**Data Format:**
```json
{
  "timestamp": "2025-10-26T19:30:00.000000Z",
  "setup_id": 1,
  "setup_name": "Monitor Power Supply",
  "instrument_id": 1,
  "instrument_name": "Power Supply 1",
  "mode": "run",
  "readings": {
    "voltage": {
      "value": 12.3,
      "raw_value": 12.3,
      "unit": "V",
      "raw_response": "12.3"
    }
  }
}
```

#### 2. Dashboard API Routes (`backend/app/api/routes/dashboard.py`)
Provides HTTP endpoints for dashboard functionality.

**Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/dashboard/summary` | Overview of all monitoring setups |
| GET | `/api/dashboard/live-data?limit=N` | Latest N readings from all setups |
| GET | `/api/dashboard/live-data/{setup_id}` | Latest readings for specific setup |
| GET | `/api/dashboard/historical-data?hours=N` | Readings from last N hours (max 168) |
| POST | `/api/dashboard/monitoring/{setup_id}/start` | Start continuous monitoring |
| POST | `/api/dashboard/monitoring/{setup_id}/stop` | Stop monitoring |
| POST | `/api/dashboard/monitoring/{setup_id}/collect` | Collect single reading |

**Storage:**
- All readings stored in `data/readings.json`
- File-based storage (no database required)
- Automatic rotation at 10,000 entries
- Pretty-printed JSON for readability

### Frontend Components

#### 1. LiveDashboard (`frontend/src/components/dashboard/LiveDashboard.tsx`)
Main container component for the live dashboard view.

**Features:**
- Auto-refresh with configurable intervals (1s - 30s)
- Manual refresh button
- Setup filtering (all setups or specific setup)
- Real-time data updates
- Loading states and error handling

**State Management:**
```typescript
const [readings, setReadings] = useState<Reading[]>([]);
const [selectedSetup, setSelectedSetup] = useState<string>('all');
const [autoRefresh, setAutoRefresh] = useState<boolean>(true);
const [refreshInterval, setRefreshInterval] = useState<number>(5);
```

#### 2. LiveChart (`frontend/src/components/dashboard/LiveChart.tsx`)
SVG-based sparkline charts for signal trend visualization.

**Features:**
- Groups readings by signal name
- Displays last 50 data points per signal
- Shows min/max/current values
- Normalized display (0-60px height range)
- Color-coded trend line (emerald)
- Point indicator for latest value

**Rendering Logic:**
```typescript
// Normalize values to 0-height range
const normalizedPoints = values.map(v => 
  ((v - min) / (max - min)) * height
);

// Generate SVG path
const path = normalizedPoints.map((y, i) => {
  const x = (i / (values.length - 1)) * width;
  return `${i === 0 ? 'M' : 'L'} ${x},${height - y}`;
}).join(' ');
```

#### 3. ReadingsTable (`frontend/src/components/dashboard/ReadingsTable.tsx`)
Tabular display of recent measurements.

**Features:**
- Reverse chronological ordering (newest first)
- Formatted timestamps
- Setup and instrument identification
- Mode display
- Formatted readings with units
- Error highlighting
- Displays last 20 readings

**Table Columns:**
- Time (formatted as "HH:MM:SS MM/DD/YYYY")
- Setup Name
- Instrument Name
- Mode
- Readings (formatted as "signal: value unit")

#### 4. MonitoringControls (`frontend/src/components/dashboard/MonitoringControls.tsx`)
Control panel for starting/stopping data collection.

**Features:**
- Setup selector
- "Collect Now" button (blue) - Single manual collection
- "Start Monitoring" button (emerald) - Continuous collection
- "Stop Monitoring" button (red) - Stop collection
- Active status indicator ("● Active")
- Loading states
- Disabled states when appropriate

**Button Logic:**
```typescript
// Start monitoring at configured frequency
const handleStart = async (setupId: number, frequency: number) => {
  await startMonitoring(setupId, frequency);
  setActiveSetups(prev => new Set(prev).add(setupId));
};

// Stop monitoring
const handleStop = async (setupId: number) => {
  await stopMonitoring(setupId);
  setActiveSetups(prev => {
    const newSet = new Set(prev);
    newSet.delete(setupId);
    return newSet;
  });
};
```

#### 5. DashboardView (`frontend/src/components/dashboard/DashboardView.tsx`)
Updated to include view toggle between Summary and Live views.

**Features:**
- Tab navigation (Summary / Live)
- Conditional rendering based on active view
- Integration with existing summary dashboard

### Data Service Layer

#### dataService.ts (`frontend/src/services/dataService.ts`)
API client for dashboard operations.

**Exports:**
```typescript
export const fetchLiveData = async (limit?: number): Promise<Reading[]>
export const fetchSetupLiveData = async (setupId: number): Promise<Reading[]>
export const fetchHistoricalData = async (hours: number): Promise<Reading[]>
export const startMonitoring = async (setupId: number): Promise<void>
export const stopMonitoring = async (setupId: number): Promise<void>
export const collectNow = async (setupId: number): Promise<Reading>
```

## Data Flow

### Collection Flow
```
1. User clicks "Start Monitoring" in MonitoringControls
2. Frontend calls startMonitoring(setupId) via dataService
3. Backend creates async task in DataCollector
4. DataCollector runs loop at configured frequency:
   a. Load monitoring setup configuration
   b. Load instrument configuration
   c. Connect to instrument via VXI-11
   d. Set instrument mode (if needed)
   e. Query all configured signals
   f. Apply scaling based on signal-mode matrix
   g. Store reading to readings.json
5. Reading appears in live dashboard on next auto-refresh
```

### Visualization Flow
```
1. LiveDashboard polls /api/dashboard/live-data every N seconds
2. Backend reads recent entries from readings.json
3. Frontend updates state with new readings
4. LiveChart re-renders sparklines with new data points
5. ReadingsTable updates with latest entries
6. MonitoringControls reflects active monitoring status
```

## Usage Guide

### Starting Monitoring

1. **Navigate to Dashboard Tab**
   - Click "Dashboard" in the main navigation
   - Switch to "Live" view using the tab toggle

2. **Start Data Collection**
   - Select a monitoring setup from the dropdown
   - Click "Start Monitoring" button
   - Setup will be marked as "● Active"
   - Data collection begins at configured frequency

3. **View Real-Time Data**
   - Charts update automatically based on refresh interval
   - Table shows most recent 20 measurements
   - Use setup filter to focus on specific setup

### Manual Collection

- Click "Collect Now" to trigger single reading
- Useful for testing or spot-checking
- Does not start continuous monitoring

### Adjusting Refresh Rate

- Use refresh interval dropdown (1s - 30s)
- Lower intervals = more real-time but higher load
- Higher intervals = less load but delayed updates
- Toggle auto-refresh on/off as needed

### Viewing Historical Data

Historical data is stored in `data/readings.json` and can be queried via API:

```bash
# Get data from last 24 hours
curl http://localhost:8000/api/dashboard/historical-data?hours=24

# Get live data for specific setup
curl http://localhost:8000/api/dashboard/live-data/1
```

## Configuration

### Monitoring Frequency

Set in monitoring setup configuration:
```json
{
  "frequency_hz": 1.0  // Collect once per second
}
```

Supported ranges:
- Minimum: 0.1 Hz (every 10 seconds)
- Maximum: 10 Hz (10 times per second)
- Recommended: 0.5 - 2 Hz for most applications

### Data Retention

- **In-memory:** Unlimited (while container running)
- **On-disk:** Last 10,000 readings
- **Auto-rotation:** Older readings deleted when limit reached

### Auto-Refresh Intervals

Available options in UI:
- 1 second (very responsive, high load)
- 2 seconds
- 5 seconds (default, balanced)
- 10 seconds
- 30 seconds (low load)

## File Structure

```
backend/
├── app/
│   ├── api/
│   │   └── routes/
│   │       └── dashboard.py          # API endpoints
│   └── services/
│       └── data_collector.py         # Data collection service

frontend/
└── src/
    ├── components/
    │   └── dashboard/
    │       ├── DashboardView.tsx     # Main dashboard with view toggle
    │       ├── LiveDashboard.tsx     # Live view container
    │       ├── LiveChart.tsx         # Sparkline charts
    │       ├── ReadingsTable.tsx     # Measurement table
    │       └── MonitoringControls.tsx # Start/stop controls
    └── services/
        └── dataService.ts            # API client

data/
└── readings.json                     # Time-series storage
```

## API Examples

### Start Monitoring
```bash
POST http://localhost:8000/api/dashboard/monitoring/1/start
```

### Stop Monitoring
```bash
POST http://localhost:8000/api/dashboard/monitoring/1/stop
```

### Collect Single Reading
```bash
POST http://localhost:8000/api/dashboard/monitoring/1/collect

Response:
{
  "timestamp": "2025-10-26T19:30:00.000000Z",
  "setup_id": 1,
  "setup_name": "Monitor Power Supply",
  "instrument_id": 1,
  "instrument_name": "Power Supply 1",
  "mode": "run",
  "readings": {
    "voltage": {
      "value": 12.3,
      "raw_value": 12.3,
      "unit": "V",
      "raw_response": "12.3"
    }
  }
}
```

### Get Live Data
```bash
GET http://localhost:8000/api/dashboard/live-data?limit=50

Response: [
  { /* reading 1 */ },
  { /* reading 2 */ },
  ...
]
```

### Get Historical Data
```bash
GET http://localhost:8000/api/dashboard/historical-data?hours=24

Response: [
  { /* reading from 24 hours ago */ },
  { /* reading from 23 hours 59 min ago */ },
  ...
  { /* latest reading */ }
]
```

## Testing

To test the live dashboard:

1. **Create an instrument** (if not already exists)
2. **Create a monitoring setup** with desired frequency
3. **Navigate to Dashboard → Live view**
4. **Start monitoring** using the control panel
5. **Observe data collection:**
   - Charts show signal trends
   - Table updates with new readings
   - Active indicator shows monitoring status

## Troubleshooting

### No data appearing
- Check monitoring setup is active ("● Active" indicator)
- Verify instrument is reachable (test in Interactive tab)
- Check browser console for API errors
- Verify readings.json has entries

### Charts not updating
- Confirm auto-refresh is enabled
- Check refresh interval setting
- Verify API calls in browser Network tab
- Ensure monitoring is started

### Data collection stops
- Check backend logs for errors
- Verify VXI-11 connection to instrument
- Review instrument mode configuration
- Check signal query commands are valid

### Performance issues
- Reduce monitoring frequency
- Increase auto-refresh interval
- Filter to specific setup instead of "all"
- Clear old readings from readings.json

## Future Enhancements

Potential improvements:
- Export historical data to CSV
- Configurable chart time windows
- Zoom/pan on charts
- Statistical analysis (mean, std dev, etc.)
- Alert thresholds and notifications
- WebSocket for true real-time updates
- Data compression for long-term storage
