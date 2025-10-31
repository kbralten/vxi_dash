"""State machine engine for monitoring setups.

This engine runs the state machine workflow defined in a MonitoringSetup:
- Loads states, transitions, and rules
- Tracks the current active state
- Evaluates transition rules on each tick
- Executes transitions by applying instrument settings
- Handles initial and end states
"""
import asyncio
import json
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from app.models.state_machine import Rule, State, Transition
from app.services.data_collector import DataCollector, get_data_collector
from app.services.vxi11_client import get_vxi11_client
from app.storage import get_storage


class StateMachineSession:
    """Represents a running state machine session for a monitoring setup."""

    def __init__(self, setup_id: int, data_collector: DataCollector):
        self.setup_id = setup_id
        self.data_collector = data_collector
        self.current_state_id: Optional[str] = None
        self.state_entered_at: Optional[datetime] = None
        self.session_started_at: Optional[datetime] = None
        self.is_running = False
        self._task: Optional[asyncio.Task] = None
        
        # Cache of setup data
        self.setup: Optional[Dict[str, Any]] = None
        self.states_by_id: Dict[str, State] = {}
        self.transitions: List[Transition] = []
        self.instruments_by_id: Dict[int, Dict[str, Any]] = {}
        
        # VXI-11 client pool: reuse connections across state transitions
        self._client_cache: Dict[str, Any] = {}

    def _load_setup(self) -> bool:
        """Load and cache the monitoring setup and its state machine definition."""
        storage = get_storage()
        self.setup = storage.get_monitoring_setup(self.setup_id)
        
        if not self.setup:
            return False
        
        # Load states
        states = self.setup.get("states", [])
        self.states_by_id = {s["id"]: s for s in states if isinstance(s, dict) and "id" in s}
        
        # Load transitions
        self.transitions = [t for t in self.setup.get("transitions", []) if isinstance(t, dict)]
        
        # Load instruments
        instruments = storage.get_instruments()
        self.instruments_by_id = {inst["id"]: inst for inst in instruments}
        
        return len(self.states_by_id) > 0

    def _get_initial_state_id(self) -> Optional[str]:
        """Get the initial state ID from the setup."""
        if not self.setup:
            return None
        return self.setup.get("initialStateID")

    def _is_end_state(self, state_id: str) -> bool:
        """Check if a state is marked as an end state."""
        state = self.states_by_id.get(state_id)
        if not state:
            return False
        return state.get("isEndState", False)

    async def _get_or_create_client(self, address: str) -> Any:
        """Get a cached VXI-11 client for an address, or create one if needed.
        
        This ensures we reuse the same client (and VXI-11 link) across multiple
        state transitions, avoiding repeated link creation overhead.
        """
        if address not in self._client_cache:
            self._client_cache[address] = await get_vxi11_client(address)
        return self._client_cache[address]
    
    async def _apply_state_settings(self, state_id: str) -> None:
        """Apply instrument settings defined in a state.
        
        Each state can define instrumentSettings as a map:
        { "instrument_id": { modeId?, modeName?, modeParams: {...} } }
        """
        state = self.states_by_id.get(state_id)
        if not state:
            return
        
        instrument_settings = state.get("instrumentSettings", {})
        if not isinstance(instrument_settings, dict):
            return
        
        for inst_id_str, settings in instrument_settings.items():
            try:
                inst_id = int(inst_id_str)
            except (ValueError, TypeError):
                continue
            
            instrument = self.instruments_by_id.get(inst_id)
            if not instrument:
                continue
            
            # Parse instrument configuration
            try:
                config = json.loads(instrument.get("description", "{}"))
            except Exception:
                continue
            
            # Find the mode to apply
            mode = self._select_mode(config, settings)
            if not mode:
                continue
            
            # Get parameters for the mode
            mode_params = settings.get("modeParams", {})
            if not isinstance(mode_params, dict):
                mode_params = {}
            
            # Get or create cached client for this instrument
            address = instrument.get("address", "")
            client = await self._get_or_create_client(address)
            
            enable_cmds = self._expand_commands(
                mode.get("enableCommands", ""), 
                mode_params
            )
            
            for cmd in enable_cmds:
                await client.write(cmd)

    def _select_mode(self, config: Dict[str, Any], settings: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Select a mode from instrument config based on settings."""
        modes = config.get("modes", [])
        if not modes:
            return None
        
        mode_id = settings.get("modeId")
        mode_name = settings.get("modeName")
        
        if mode_id:
            for m in modes:
                if m.get("id") == mode_id:
                    return m
        
        if mode_name:
            for m in modes:
                if m.get("name") == mode_name:
                    return m
        
        return modes[0]

    def _expand_commands(self, block: str, params: Dict[str, Any]) -> List[str]:
        """Expand a multi-line SCPI block with {param} placeholders."""
        if not block:
            return []
        
        lines = [ln.strip() for ln in block.splitlines() if ln.strip()]
        
        def substitute(cmd: str) -> str:
            result = cmd
            for key, value in params.items():
                result = result.replace("{" + str(key) + "}", str(value))
            return result
        
        return [substitute(ln) for ln in lines]

    async def _evaluate_rule(self, rule: Rule) -> bool:
        """Evaluate a single rule to see if its condition is met."""
        rule_type = rule.get("type")
        
        if rule_type == "sensor":
            return await self._evaluate_sensor_rule(rule)
        elif rule_type == "timeInState":
            return self._evaluate_time_in_state_rule(rule)
        elif rule_type == "totalTime":
            return self._evaluate_total_time_rule(rule)
        
        return False

    async def _evaluate_sensor_rule(self, rule: Rule) -> bool:
        """Evaluate a sensor-based rule: IF signal_name operator value."""
        signal_name = rule.get("signalName")
        operator = rule.get("operator")
        threshold = rule.get("value")
        
        if not signal_name or not operator or threshold is None:
            return False
        
        # Get latest reading for this setup
        latest_reading = await self.data_collector.collect_from_setup(self.setup_id)
        if not latest_reading or "readings" not in latest_reading:
            return False
        
        readings = latest_reading.get("readings", {})
        signal_data = readings.get(signal_name)
        
        if not signal_data or signal_data.get("value") is None:
            return False
        
        current_value = signal_data["value"]
        
        # Apply comparison operator
        if operator == ">":
            return current_value > threshold
        elif operator == "<":
            return current_value < threshold
        elif operator == ">=":
            return current_value >= threshold
        elif operator == "<=":
            return current_value <= threshold
        elif operator == "==":
            return current_value == threshold
        elif operator == "!=":
            return current_value != threshold
        
        return False

    def _evaluate_time_in_state_rule(self, rule: Rule) -> bool:
        """Evaluate a time-in-state rule: AFTER seconds in current state."""
        seconds = rule.get("seconds")
        
        if seconds is None or not self.state_entered_at:
            return False
        
        elapsed = (datetime.utcnow() - self.state_entered_at).total_seconds()
        return elapsed >= seconds

    def _evaluate_total_time_rule(self, rule: Rule) -> bool:
        """Evaluate a total-time rule: IF total session time >= seconds."""
        seconds = rule.get("seconds")
        
        if seconds is None or not self.session_started_at:
            return False
        
        elapsed = (datetime.utcnow() - self.session_started_at).total_seconds()
        return elapsed >= seconds

    async def _check_transitions(self) -> Optional[str]:
        """Check all transitions from the current state.
        
        Returns the target state ID if a transition should occur, None otherwise.
        """
        if not self.current_state_id:
            return None
        
        # Find transitions originating from current state
        outgoing = [
            t for t in self.transitions 
            if t.get("sourceStateID") == self.current_state_id
        ]
        
        # Check each transition's rules
        for transition in outgoing:
            rules = transition.get("rules", [])
            if not rules:
                continue
            
            # All rules must be satisfied (AND logic)
            all_satisfied = True
            for rule in rules:
                if not await self._evaluate_rule(rule):
                    all_satisfied = False
                    break
            
            if all_satisfied:
                return transition.get("targetStateID")
        
        return None

    async def _transition_to(self, state_id: str) -> None:
        """Execute a transition to a new state."""
        if state_id not in self.states_by_id:
            return
        
        print(f"[StateMachine {self.setup_id}] Transitioning to state: {state_id}")
        
        # Update current state
        self.current_state_id = state_id
        self.state_entered_at = datetime.utcnow()
        
        # Check if this is an end state
        if self._is_end_state(state_id):
            print(f"[StateMachine {self.setup_id}] Reached end state, stopping")
            # Record the final end state
            state = self.states_by_id.get(state_id)
            if state:
                state_name = state.get("name", state_id)
                self.data_collector.record_end_state(self.setup_id, state_id, state_name)
            await self.stop()
            return
        
        # Apply instrument settings for new state (only if not an end state)
        await self._apply_state_settings(state_id)

    async def _tick(self) -> None:
        """Execute one state machine evaluation cycle."""
        if not self.is_running or not self.current_state_id:
            return
        
        # Check for transitions
        target_state = await self._check_transitions()
        
        if target_state:
            await self._transition_to(target_state)

    async def _run_loop(self) -> None:
        """Main state machine loop."""
        # Default tick rate: 1 Hz (can be made configurable)
        tick_interval = 1.0
        
        while self.is_running:
            try:
                await self._tick()
                await asyncio.sleep(tick_interval)
            except asyncio.CancelledError:
                break
            except Exception as e:
                print(f"[StateMachine {self.setup_id}] Error in tick: {e}")
                await asyncio.sleep(tick_interval)

    async def start(self) -> bool:
        """Start the state machine session.
        
        Returns True if started successfully, False otherwise.
        """
        if self.is_running:
            return False
        
        # Load setup configuration
        if not self._load_setup():
            print(f"[StateMachine {self.setup_id}] Failed to load setup")
            return False
        
        # Get initial state
        initial_state_id = self._get_initial_state_id()
        if not initial_state_id or initial_state_id not in self.states_by_id:
            print(f"[StateMachine {self.setup_id}] No valid initial state")
            return False
        
        # Initialize session
        self.session_started_at = datetime.utcnow()
        self.is_running = True
        
        # Transition to initial state
        await self._transition_to(initial_state_id)
        
        # Start monitoring loop
        self.data_collector.start_monitoring(self.setup_id)
        
        # Start state machine loop
        self._task = asyncio.create_task(self._run_loop())
        
        print(f"[StateMachine {self.setup_id}] Started in state: {initial_state_id}")
        return True

    async def stop(self) -> None:
        """Stop the state machine session."""
        if not self.is_running:
            return
        
        self.is_running = False
        
        # Cancel state machine loop
        if self._task:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            self._task = None
        
        # Stop data monitoring
        self.data_collector.stop_monitoring(self.setup_id)
        
        # Disable instruments
        await self.data_collector.disable_mode_for_setup(self.setup_id)
        
        # Clear client cache to release VXI-11 connections
        self._client_cache.clear()
        
        print(f"[StateMachine {self.setup_id}] Stopped")

    def get_status(self) -> Dict[str, Any]:
        """Get current state machine status."""
        return {
            "setup_id": self.setup_id,
            "is_running": self.is_running,
            "current_state_id": self.current_state_id,
            "session_started_at": self.session_started_at.isoformat() + "Z" if self.session_started_at else None,
            "state_entered_at": self.state_entered_at.isoformat() + "Z" if self.state_entered_at else None,
            "time_in_current_state": (
                (datetime.utcnow() - self.state_entered_at).total_seconds()
                if self.state_entered_at else None
            ),
            "total_session_time": (
                (datetime.utcnow() - self.session_started_at).total_seconds()
                if self.session_started_at else None
            ),
        }


class StateMachineEngine:
    """Manages state machine sessions for multiple monitoring setups."""

    def __init__(self):
        self.sessions: Dict[int, StateMachineSession] = {}
        self.data_collector = get_data_collector()

    async def start_session(self, setup_id: int) -> bool:
        """Start a state machine session for a setup.
        
        Returns True if started successfully, False otherwise.
        """
        # Stop existing session if any
        if setup_id in self.sessions:
            await self.stop_session(setup_id)
        
        # Create and start new session
        session = StateMachineSession(setup_id, self.data_collector)
        success = await session.start()
        
        if success:
            self.sessions[setup_id] = session
        
        return success

    async def stop_session(self, setup_id: int) -> bool:
        """Stop a state machine session.
        
        Returns True if a session was stopped, False if none existed.
        """
        session = self.sessions.get(setup_id)
        if not session:
            return False
        
        await session.stop()
        del self.sessions[setup_id]
        return True

    def get_session_status(self, setup_id: int) -> Optional[Dict[str, Any]]:
        """Get status of a session."""
        session = self.sessions.get(setup_id)
        if not session:
            return None
        
        return session.get_status()

    def get_all_sessions_status(self) -> List[Dict[str, Any]]:
        """Get status of all active sessions."""
        return [session.get_status() for session in self.sessions.values()]

    async def stop_all_sessions(self) -> None:
        """Stop all running sessions."""
        for session in list(self.sessions.values()):
            await session.stop()
        self.sessions.clear()


# Singleton instance
_engine: Optional[StateMachineEngine] = None


def get_state_machine_engine() -> StateMachineEngine:
    """Get the state machine engine singleton."""
    global _engine
    if _engine is None:
        _engine = StateMachineEngine()
    return _engine
