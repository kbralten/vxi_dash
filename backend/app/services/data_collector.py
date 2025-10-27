"""Data collection service for monitoring setups."""
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.services.vxi11_client import get_vxi11_client
from app.storage import get_storage


class DataCollector:
    """Collects data from instruments based on monitoring configurations."""

    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.readings_file = self.data_dir / "readings.json"
        self._ensure_file_exists()
        self._running = False
        self._tasks: Dict[int, asyncio.Task] = {}

    def _ensure_file_exists(self) -> None:
        """Create empty readings file if it doesn't exist."""
        if not self.readings_file.exists():
            self.readings_file.write_text("[]")

    def _load_readings(self) -> List[Dict[str, Any]]:
        """Load all readings from file."""
        try:
            return json.loads(self.readings_file.read_text())
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_reading(self, reading: Dict[str, Any]) -> None:
        """Append a new reading to the file."""
        readings = self._load_readings()
        readings.append(reading)
        
        # Keep only last 10000 readings to prevent file from growing too large
        if len(readings) > 10000:
            readings = readings[-10000:]
        
        self.readings_file.write_text(json.dumps(readings, indent=2))

    async def collect_from_setup(self, setup_id: int) -> Optional[Dict[str, Any]]:
        """Collect data from a single monitoring setup."""
        storage = get_storage()
        
        # Get monitoring setup
        setup = storage.get_monitoring_setup(setup_id)
        if not setup:
            return None
        
        # Get instrument
        instrument = storage.get_instrument(setup["instrument_id"])
        if not instrument or not instrument.get("is_active"):
            return None
        
        try:
            # Parse instrument configuration
            config = json.loads(instrument["description"])
            params = json.loads(setup["parameters"])
            
            # Parse address
            address = instrument["address"]
            host_port = address.split("/")[0] if "/" in address else address
            
            # Create VXI-11 client
            client = await get_vxi11_client(host_port)
            
            # Get mode configuration
            mode = params.get("mode")
            if not mode or mode not in config.get("mode", {}):
                return None
            
            # Collect readings for each signal
            readings = {}
            signals = params.get("signals", [])
            
            for signal_name in signals:
                if signal_name not in config.get("signal", {}):
                    continue
                
                # Get measure command
                measure_command = config["signal"][signal_name]
                
                try:
                    # Execute command
                    response = await client.query(measure_command)
                    
                    # Get signal-mode configuration for units and scaling
                    signal_config = config.get("signal_mode_config", {}).get(signal_name, {}).get(mode, {})
                    unit = signal_config.get("unit", "")
                    scale = signal_config.get("scale", 1.0)
                    
                    # Try to parse numeric value from response
                    try:
                        # Extract first number from response
                        import re
                        match = re.search(r'[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?', response)
                        value = float(match.group()) if match else 0.0
                        scaled_value = value * scale
                    except (ValueError, AttributeError):
                        value = 0.0
                        scaled_value = 0.0
                    
                    readings[signal_name] = {
                        "value": scaled_value,
                        "raw_value": value,
                        "unit": unit,
                        "raw_response": response,
                    }
                except Exception as e:
                    readings[signal_name] = {
                        "value": None,
                        "error": str(e),
                    }
            
            # Create reading record
            reading = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "setup_id": setup_id,
                "setup_name": setup["name"],
                "instrument_id": instrument["id"],
                "instrument_name": instrument["name"],
                "mode": mode,
                "readings": readings,
            }
            
            # Save to file
            self._save_reading(reading)
            
            return reading
            
        except Exception as e:
            return {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "setup_id": setup_id,
                "error": str(e),
            }

    async def monitor_setup(self, setup_id: int) -> None:
        """Continuously monitor a setup at its configured frequency."""
        storage = get_storage()
        
        while self._running:
            try:
                setup = storage.get_monitoring_setup(setup_id)
                if not setup:
                    break
                
                frequency_hz = setup.get("frequency_hz", 1.0)
                interval = 1.0 / frequency_hz if frequency_hz > 0 else 1.0
                
                # Collect data
                await self.collect_from_setup(setup_id)
                
                # Wait for next collection
                await asyncio.sleep(interval)
                
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"Error monitoring setup {setup_id}: {e}")
                await asyncio.sleep(1.0)

    def start_monitoring(self, setup_id: int) -> None:
        """Start monitoring a setup."""
        if setup_id in self._tasks:
            return
        
        self._running = True
        task = asyncio.create_task(self.monitor_setup(setup_id))
        self._tasks[setup_id] = task

    def stop_monitoring(self, setup_id: int) -> None:
        """Stop monitoring a setup."""
        if setup_id in self._tasks:
            self._tasks[setup_id].cancel()
            del self._tasks[setup_id]

    def stop_all(self) -> None:
        """Stop all monitoring tasks."""
        self._running = False
        for task in self._tasks.values():
            task.cancel()
        self._tasks.clear()

    def get_latest_readings(self, limit: int = 100) -> List[Dict[str, Any]]:
        """Get the latest N readings."""
        readings = self._load_readings()
        return readings[-limit:]

    def get_readings_for_setup(self, setup_id: int, limit: int = 100) -> List[Dict[str, Any]]:
        """Get latest readings for a specific setup."""
        readings = self._load_readings()
        setup_readings = [r for r in readings if r.get("setup_id") == setup_id]
        return setup_readings[-limit:]

    def get_readings_by_time_range(
        self, start_time: datetime, end_time: datetime
    ) -> List[Dict[str, Any]]:
        """Get readings within a time range."""
        readings = self._load_readings()
        filtered = []
        
        for reading in readings:
            try:
                timestamp = datetime.fromisoformat(reading["timestamp"].replace("Z", "+00:00"))
                if start_time <= timestamp <= end_time:
                    filtered.append(reading)
            except (KeyError, ValueError):
                continue
        
        return filtered


# Singleton instance
_collector: Optional[DataCollector] = None


def get_data_collector() -> DataCollector:
    """Get data collector instance."""
    global _collector
    if _collector is None:
        _collector = DataCollector()
    return _collector
