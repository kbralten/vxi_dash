# VXI-11 Dashboard Configuration Files

This directory contains the JSON configuration files for the VXI-11 Dashboard application.

## Files

### `instruments.json`
Contains the configuration for all instruments. Each instrument has:
- `id`: Unique identifier (auto-generated)
- `name`: Display name
- `address`: VXI-11 address in format `IP:Port/Identifier` (e.g., `127.0.0.1:1024/power`)
- `description`: Optional description or advanced configuration JSON
- `is_active`: Boolean indicating if the instrument is active

Example:
```json
[
  {
    "id": 1,
    "name": "Power Supply",
    "address": "127.0.0.1:1024/power",
    "description": "Main lab power supply",
    "is_active": true
  }
]
```

### `monitoring.json`
Contains monitoring setup configurations. Each setup has:
- `id`: Unique identifier (auto-generated)
- `name`: Display name
- `frequency_hz`: Measurement frequency in Hz
- `instrument_id`: Reference to instrument ID
- `parameters`: JSON object with mode-specific parameters

Example:
```json
[
  {
    "id": 1,
    "name": "5V Rail",
    "frequency_hz": 1.0,
    "instrument_id": 1,
    "parameters": {
      "volts": 5.0,
      "amps": 2.0
    }
  }
]
```

### `readings.json`
Contains historical measurement data collected from monitoring setups. This file grows over time and is automatically trimmed to the last 10,000 readings. Each reading has:
- `timestamp`: UTC timestamp when reading was taken
- `setup_id`: Monitoring setup that collected the data
- `setup_name`: Name of the monitoring setup
- `instrument_id`: Instrument that was queried
- `instrument_name`: Name of the instrument
- `mode`: Instrument mode during reading
- `readings`: Object with signal readings, each containing:
  - `value`: Scaled value according to signal-mode configuration
  - `raw_value`: Original unscaled value from instrument
  - `unit`: Unit of measurement
  - `raw_response`: Raw string response from instrument
  - `error`: Error message if reading failed (optional)

Example:
```json
[
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
]
```

**Note:** This file is excluded from version control as it can become very large.

## Editing Configuration Files

These files can be edited by hand. The application will automatically reload the configuration when the files are saved.

**Important Notes:**
- Ensure valid JSON syntax
- IDs must be unique within each file
- `instrument_id` in monitoring.json must reference an existing instrument ID
- Names must be unique within each file type
- The application will validate configurations on startup
