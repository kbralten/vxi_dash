"""Data collection service for monitoring setups."""
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional, TYPE_CHECKING

from app.services.vxi11_client import get_vxi11_client
from app.storage import get_storage

if TYPE_CHECKING:
    from app.services.state_machine_engine import StateMachineEngine


class DataCollector:
    """Collects data from instruments based on monitoring configurations."""

    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.readings_file = self.data_dir / "readings.json"
        self._ensure_file_exists()
        self._running = False
        self._tasks: Dict[int, asyncio.Task] = {}
        # Track enabled modes per (setup_id, instrument_id)
        self._enabled_modes: Dict[str, str] = {}
        self._last_status: Dict[int, Dict[str, Any]] = {}

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

    def _parse_instrument_config(self, instrument: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Parse the instrument description JSON into a dict.

        Expected shape (from frontend wizard):
        {
          "description": str,
          "signals": [{ id, name, measureCommand }],
          "modes": [{ id, name, enableCommands, disableCommands, parameters: [] }],
          "signalModeConfigs": [{ modeId, signalId, unit, scalingFactor }]
        }
        """
        try:
            return json.loads(instrument.get("description") or "{}")
        except Exception:
            return None

    def _select_mode(self, cfg: Dict[str, Any], setup_params: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        modes = cfg.get("modes", [])
        if not modes:
            return None
        mid = setup_params.get("modeId") or setup_params.get("mode_id")
        mname = setup_params.get("modeName") or setup_params.get("mode")
        if mid:
            for m in modes:
                if m.get("id") == mid:
                    return m
        if mname:
            for m in modes:
                if m.get("name") == mname:
                    return m
        # default to first
        return modes[0]

    def _selected_signal_ids(self, cfg: Dict[str, Any], setup_params: Dict[str, Any]) -> List[str]:
        # Accept ids or names; default to all signals
        sigs = cfg.get("signals", [])
        all_ids = [s.get("id") for s in sigs if s.get("id")]
        ids = setup_params.get("signalIds") or setup_params.get("signals") or setup_params.get("selectedSignals")
        if not ids:
            return all_ids
        # Map names to ids if needed
        name_to_id = {s.get("name"): s.get("id") for s in sigs}
        resolved: List[str] = []
        for item in ids:
            if item in all_ids:
                resolved.append(item)
            elif item in name_to_id and name_to_id[item]:
                resolved.append(name_to_id[item])
        return resolved or all_ids

    def _expand_commands(self, block: str, params: Dict[str, Any]) -> List[str]:
        """Expand a multi-line SCPI block with {param} placeholders."""
        if not block:
            return []
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        def subst(cmd: str) -> str:
            out = cmd
            for k, v in params.items():
                out = out.replace("{" + str(k) + "}", str(v))
            return out
        return [subst(ln) for ln in lines]

    def _lookup_signal_cfg(self, cfg: Dict[str, Any], mode: Dict[str, Any], signal_id: str) -> Dict[str, Any]:
        entries = cfg.get("signalModeConfigs", [])
        mid = mode.get("id")
        for e in entries:
            if e.get("modeId") == mid and e.get("signalId") == signal_id:
                return e
        return {}

    def _normalize_unit_and_scale(self, unit: str, scale: float) -> (str, float):
        """Normalize secondary units to base units by adjusting scale.

        Only multiplicative prefixes are handled here. Units with offsets (e.g., °F) are left unchanged
        because our scaling factor cannot encode an offset.
        """
        mapping: Dict[str, Dict[str, Any]] = {
            "mV": {"base": "V", "mul": 1e-3},
            "A": {"base": "A", "mul": 1.0},
            "mA": {"base": "A", "mul": 1e-3},
            "μA": {"base": "A", "mul": 1e-6},
            "uA": {"base": "A", "mul": 1e-6},
            "Ω": {"base": "Ω", "mul": 1.0},
            "kΩ": {"base": "Ω", "mul": 1e3},
            "MΩ": {"base": "Ω", "mul": 1e6},
            "Hz": {"base": "Hz", "mul": 1.0},
            "kHz": {"base": "Hz", "mul": 1e3},
            "MHz": {"base": "Hz", "mul": 1e6},
            "W": {"base": "W", "mul": 1.0},
            "mW": {"base": "W", "mul": 1e-3},
            # Leave dB/dBm as-is; dBm implies reference and offset that scaling cannot capture
            "dB": {"base": "dB", "mul": 1.0},
            "dBm": {"base": "dBm", "mul": 1.0},
            "V": {"base": "V", "mul": 1.0},
            "s": {"base": "s", "mul": 1.0},
            "ms": {"base": "s", "mul": 1e-3},
            "μs": {"base": "s", "mul": 1e-6},
            "us": {"base": "s", "mul": 1e-6},
            "ns": {"base": "s", "mul": 1e-9},
            # Temperatures
            "°C": {"base": "°C", "mul": 1.0},
            "C": {"base": "°C", "mul": 1.0},
            # "°F" left unchanged intentionally
        }
        if not unit:
            return unit, scale
        info = mapping.get(unit)
        if not info:
            return unit, scale
        base = info["base"]
        mul = float(info["mul"]) if isinstance(info["mul"], (int, float)) else 1.0
        return base, scale * mul

    async def _execute_block(self, client: Any, commands: List[str]) -> None:
        for cmd in commands:
            # Treat queries as writes only if needed; usually enable/disable are writes
            await client.write(cmd)

    async def _enable_for_target(self, setup_id: int, instrument: Dict[str, Any], params: Dict[str, Any]) -> None:
        cfg = self._parse_instrument_config(instrument)
        if not cfg:
            return
        mode = self._select_mode(cfg, params)
        if not mode:
            return
        key = f"{setup_id}:{instrument.get('id')}"
        if self._enabled_modes.get(key) == (mode.get("id") or mode.get("name") or ""):
            return
        
        # Check if state machine is running - if so, skip auto-enable
        # The state machine manages instrument settings itself
        try:
            from app.services.state_machine_engine import get_state_machine_engine
            engine = get_state_machine_engine()
            status = engine.get_session_status(setup_id)
            if status and status.get("is_running"):
                print(f"[DataCollector] Skipping auto-enable for setup {setup_id} - state machine is running")
                return
        except Exception:
            pass
        
        address = instrument.get("address", "")
        client = await get_vxi11_client(address)
        enable_cmds = self._expand_commands(mode.get("enableCommands", ""), params.get("modeParams", params))
        await self._execute_block(client, enable_cmds)
        self._enabled_modes[key] = mode.get("id") or mode.get("name") or ""

    async def enable_mode_for_setup(self, setup_id: int) -> None:
        storage = get_storage()
        setup = storage.get_monitoring_setup(setup_id)
        if not setup:
            return
        targets = setup.get("instruments") or []
        if targets:
            for t in targets:
                instrument = storage.get_instrument(t.get("instrument_id"))
                if not instrument:
                    continue
                params = t.get("parameters") or {}
                if isinstance(params, str):
                    try:
                        params = json.loads(params)
                    except Exception:
                        params = {}
                await self._enable_for_target(setup_id, instrument, params)
        else:
            instrument = storage.get_instrument(setup.get("instrument_id"))
            if not instrument:
                return
            params = setup.get("parameters") or {}
            if isinstance(params, str):
                try:
                    params = json.loads(params)
                except Exception:
                    params = {}
            await self._enable_for_target(setup_id, instrument, params)

    async def _disable_for_target(self, setup_id: int, instrument: Dict[str, Any], params: Dict[str, Any]) -> None:
        cfg = self._parse_instrument_config(instrument)
        if not cfg:
            return
        mode = self._select_mode(cfg, params)
        if not mode:
            return
        address = instrument.get("address", "")
        client = await get_vxi11_client(address)
        disable_cmds = self._expand_commands(mode.get("disableCommands", ""), params.get("modeParams", params))
        await self._execute_block(client, disable_cmds)
        key = f"{setup_id}:{instrument.get('id')}"
        self._enabled_modes.pop(key, None)

    async def disable_mode_for_setup(self, setup_id: int) -> None:
        storage = get_storage()
        setup = storage.get_monitoring_setup(setup_id)
        if not setup:
            return
        targets = setup.get("instruments") or []
        if targets:
            for t in targets:
                instrument = storage.get_instrument(t.get("instrument_id"))
                if not instrument:
                    continue
                params = t.get("parameters") or {}
                if isinstance(params, str):
                    try:
                        params = json.loads(params)
                    except Exception:
                        params = {}
                await self._disable_for_target(setup_id, instrument, params)
        else:
            instrument = storage.get_instrument(setup.get("instrument_id"))
            if not instrument:
                return
            params = setup.get("parameters") or {}
            if isinstance(params, str):
                try:
                    params = json.loads(params)
                except Exception:
                    params = {}
            await self._disable_for_target(setup_id, instrument, params)

    async def collect_from_setup(self, setup_id: int) -> Optional[Dict[str, Any]]:
        """Collect data from a single monitoring setup."""
        storage = get_storage()
        
        # Get monitoring setup
        setup = storage.get_monitoring_setup(setup_id)
        if not setup:
            return None
        
        try:
            last_reading: Optional[Dict[str, Any]] = None

            # Ensure modes enabled for all targets (single or multi)
            await self.enable_mode_for_setup(setup_id)

            # Multi-instrument path
            targets = setup.get("instruments") or []
            if targets:
                for t in targets:
                    instrument = storage.get_instrument(t.get("instrument_id"))
                    if not instrument or not instrument.get("is_active"):
                        continue
                    params = t.get("parameters") or {}
                    if isinstance(params, str):
                        try:
                            params = json.loads(params)
                        except Exception:
                            params = {}
                    config = self._parse_instrument_config(instrument)
                    if not config:
                        continue
                    # Create client
                    address = instrument.get("address", "")
                    client = await get_vxi11_client(address)
                    # Mode and signals
                    mode = self._select_mode(config, params)
                    if not mode:
                        continue
                    signal_ids = self._selected_signal_ids(config, params)
                    sig_by_id = {s.get("id"): s for s in config.get("signals", [])}
                    readings: Dict[str, Any] = {}
                    for sid in signal_ids:
                        sig = sig_by_id.get(sid)
                        if not sig:
                            continue
                        measure_command = sig.get("measureCommand") or ""
                        if not measure_command:
                            continue
                        try:
                            response = await client.query(measure_command)
                            smc = self._lookup_signal_cfg(config, mode, sid)
                            unit = smc.get("unit", "")
                            scale = smc.get("scalingFactor", 1)
                            unit, scale = self._normalize_unit_and_scale(unit, scale)
                            import re
                            match = re.search(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", response)
                            value = float(match.group()) if match else None
                            scaled_value = (value * scale) if (value is not None) else None
                            readings[sig.get("name") or sid] = {
                                "value": scaled_value,
                                "raw_value": value,
                                "unit": unit,
                                "raw_response": response,
                            }
                        except Exception as e:
                            readings[sig.get("name") or sid] = {"value": None, "error": str(e)}
                    reading = {
                        "timestamp": datetime.utcnow().isoformat() + "Z",
                        "setup_id": setup_id,
                        "setup_name": setup["name"],
                        "instrument_id": instrument["id"],
                        "instrument_name": instrument["name"],
                        "mode": mode,
                        "readings": readings,
                    }
                    # Add state machine info if available
                    self._add_state_machine_info(reading, setup_id)
                    self._save_reading(reading)
                    last_reading = reading
                # Update last status after processing all
                if last_reading is not None:
                    self._last_status[setup_id] = {"last_success": last_reading["timestamp"], "last_error": None}
                return last_reading

            # Single-instrument fallback
            instrument = storage.get_instrument(setup.get("instrument_id"))
            if not instrument or not instrument.get("is_active"):
                return None
            params = setup.get("parameters") or {}
            if isinstance(params, str):
                try:
                    params = json.loads(params)
                except Exception:
                    params = {}
            config = self._parse_instrument_config(instrument)
            if not config:
                return None
            address = instrument.get("address", "")
            client = await get_vxi11_client(address)
            mode = self._select_mode(config, params)
            if not mode:
                return None
            signal_ids = self._selected_signal_ids(config, params)
            sig_by_id = {s.get("id"): s for s in config.get("signals", [])}
            readings: Dict[str, Any] = {}
            for sid in signal_ids:
                sig = sig_by_id.get(sid)
                if not sig:
                    continue
                measure_command = sig.get("measureCommand") or ""
                if not measure_command:
                    continue
                try:
                    response = await client.query(measure_command)
                    smc = self._lookup_signal_cfg(config, mode, sid)
                    unit = smc.get("unit", "")
                    scale = smc.get("scalingFactor", 1)
                    unit, scale = self._normalize_unit_and_scale(unit, scale)
                    import re
                    match = re.search(r"[-+]?\d*\.?\d+(?:[eE][-+]?\d+)?", response)
                    value = float(match.group()) if match else None
                    scaled_value = (value * scale) if (value is not None) else None
                    readings[sig.get("name") or sid] = {
                        "value": scaled_value,
                        "raw_value": value,
                        "unit": unit,
                        "raw_response": response,
                    }
                except Exception as e:
                    readings[sig.get("name") or sid] = {"value": None, "error": str(e)}
            reading = {
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "setup_id": setup_id,
                "setup_name": setup["name"],
                "instrument_id": instrument["id"],
                "instrument_name": instrument["name"],
                "mode": mode,
                "readings": readings,
            }
            # Add state machine info if available
            self._add_state_machine_info(reading, setup_id)
            self._save_reading(reading)
            self._last_status[setup_id] = {"last_success": reading["timestamp"], "last_error": None}
            return reading
            
        except Exception as e:
            ts = datetime.utcnow().isoformat() + "Z"
            self._last_status[setup_id] = {"last_success": None, "last_error": str(e), "timestamp": ts}
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
        # Mark disabled; disable commands executed via API endpoint to allow awaited call
        self._enabled_modes.pop(setup_id, None)

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

    def get_all_readings_for_setup(self, setup_id: int) -> List[Dict[str, Any]]:
        """Get all readings for a specific setup (no limit)."""
        readings = self._load_readings()
        return [r for r in readings if r.get("setup_id") == setup_id]

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

    def get_status(self, setup_id: int) -> Dict[str, Any]:
        """Return running status and last activity for a setup."""
        running = setup_id in self._tasks and not self._tasks[setup_id].cancelled()
        status = self._last_status.get(setup_id, {})
        return {"running": running, **status}

    def get_running_setup_ids(self) -> List[int]:
        """Get list of setup IDs that are currently running."""
        return [setup_id for setup_id, task in self._tasks.items() if not task.cancelled()]

    def get_instruments_in_use(self) -> Dict[int, List[int]]:
        """Get mapping of instrument_id -> [setup_ids] for all instruments currently in use.
        
        Returns a dict where keys are instrument IDs and values are lists of setup IDs using them.
        """
        storage = get_storage()
        instruments_in_use: Dict[int, List[int]] = {}
        
        for setup_id in self.get_running_setup_ids():
            setup = storage.get_monitoring_setup(setup_id)
            if not setup:
                continue
            
            # Check both old single-instrument and new multi-instrument format
            instrument_ids = []
            
            # Old format: instrument_id
            if "instrument_id" in setup:
                instrument_ids.append(setup["instrument_id"])
            
            # New format: instruments array
            for target in setup.get("instruments", []):
                inst_id = target.get("instrument_id")
                if inst_id:
                    instrument_ids.append(inst_id)
            
            # Add to mapping
            for inst_id in instrument_ids:
                if inst_id not in instruments_in_use:
                    instruments_in_use[inst_id] = []
                instruments_in_use[inst_id].append(setup_id)
        
        # Also check state machine sessions
        try:
            from app.services.state_machine_engine import get_state_machine_engine
            engine = get_state_machine_engine()
            
            for session_status in engine.get_all_sessions_status():
                if not session_status.get("is_running"):
                    continue
                    
                setup_id = session_status.get("setup_id")
                if not setup_id:
                    continue
                    
                setup = storage.get_monitoring_setup(setup_id)
                if not setup:
                    continue
                
                instrument_ids = []
                if "instrument_id" in setup:
                    instrument_ids.append(setup["instrument_id"])
                for target in setup.get("instruments", []):
                    inst_id = target.get("instrument_id")
                    if inst_id:
                        instrument_ids.append(inst_id)
                
                for inst_id in instrument_ids:
                    if inst_id not in instruments_in_use:
                        instruments_in_use[inst_id] = []
                    if setup_id not in instruments_in_use[inst_id]:
                        instruments_in_use[inst_id].append(setup_id)
        except Exception:
            pass
        
        return instruments_in_use

    def check_instrument_conflicts(self, setup_id: int) -> Optional[Dict[str, Any]]:
        """Check if any instruments in the given setup are already in use.
        
        Returns None if no conflicts, otherwise returns a dict with conflict details.
        """
        storage = get_storage()
        setup = storage.get_monitoring_setup(setup_id)
        if not setup:
            return {"error": "Setup not found"}
        
        # Get instruments for this setup
        instrument_ids = []
        if "instrument_id" in setup:
            instrument_ids.append(setup["instrument_id"])
        for target in setup.get("instruments", []):
            inst_id = target.get("instrument_id")
            if inst_id:
                instrument_ids.append(inst_id)
        
        if not instrument_ids:
            return {"error": "Setup has no instruments configured"}
        
        # Check for conflicts
        instruments_in_use = self.get_instruments_in_use()
        conflicts = []
        
        for inst_id in instrument_ids:
            if inst_id in instruments_in_use:
                conflicting_setups = [sid for sid in instruments_in_use[inst_id] if sid != setup_id]
                if conflicting_setups:
                    instrument = storage.get_instrument(inst_id)
                    inst_name = instrument.get("name") if instrument else f"ID {inst_id}"
                    
                    conflict_details = []
                    for other_setup_id in conflicting_setups:
                        other_setup = storage.get_monitoring_setup(other_setup_id)
                        setup_name = other_setup.get("name") if other_setup else f"ID {other_setup_id}"
                        conflict_details.append({"setup_id": other_setup_id, "setup_name": setup_name})
                    
                    conflicts.append({
                        "instrument_id": inst_id,
                        "instrument_name": inst_name,
                        "conflicting_setups": conflict_details
                    })
        
        if conflicts:
            return {"conflicts": conflicts}
        
        return None

    def _add_state_machine_info(self, reading: Dict[str, Any], setup_id: int) -> None:
        """Add current state machine state to a reading if available."""
        try:
            # Avoid circular import by importing here
            from app.services.state_machine_engine import get_state_machine_engine
            engine = get_state_machine_engine()
            status = engine.get_session_status(setup_id)
            if status and status.get("is_running"):
                state_info = {
                    "current_state_id": status.get("current_state_id"),
                    "time_in_state": status.get("time_in_current_state"),
                    "session_time": status.get("total_session_time"),
                }
                reading["state_machine"] = state_info
        except Exception:
            # If state machine engine not available or other error, just skip
            pass

    def record_end_state(self, setup_id: int, state_id: str, state_name: str) -> None:
        """Record a final reading when state machine reaches an end state."""
        storage = get_storage()
        setup = storage.get_monitoring_setup(setup_id)
        if not setup:
            return
        
        reading = {
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "setup_id": setup_id,
            "setup_name": setup["name"],
            "readings": {},
            "state_machine": {
                "current_state_id": state_id,
                "state_name": state_name,
                "is_end_state": True,
            },
        }
        self._save_reading(reading)

    def reset_readings_for_setup(self, setup_id: int) -> int:
        """Remove readings for a specific setup. Returns number removed."""
        readings = self._load_readings()
        before = len(readings)
        readings = [r for r in readings if r.get("setup_id") != setup_id]
        self.readings_file.write_text(json.dumps(readings, indent=2))
        return before - len(readings)


# Singleton instance
_collector: Optional[DataCollector] = None


def get_data_collector() -> DataCollector:
    """Get data collector instance."""
    global _collector
    if _collector is None:
        _collector = DataCollector()
    return _collector
