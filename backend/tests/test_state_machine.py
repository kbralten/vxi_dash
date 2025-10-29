"""Tests for state machine engine functionality."""
import asyncio
import json
from datetime import datetime
from typing import Any, Dict
from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from app.services.state_machine_engine import StateMachineEngine, StateMachineSession
from app.services.data_collector import DataCollector


@pytest.fixture
def mock_storage():
    """Mock storage with test monitoring setup and instruments."""
    with patch("app.services.state_machine_engine.get_storage") as mock:
        storage = MagicMock()
        
        # Mock instrument with simple description
        instrument = {
            "id": 1,
            "name": "Test Power Supply",
            "address": "192.168.1.100/inst0",
            "description": json.dumps({
                "signals": [
                    {"id": "voltage", "name": "Voltage", "measureCommand": "MEAS:VOLT?"}
                ],
                "modes": [
                    {
                        "id": "output_on",
                        "name": "Output On",
                        "enableCommands": "OUTP ON\nVOLT {volts}\nCURR {amps}",
                        "disableCommands": "OUTP OFF"
                    },
                    {
                        "id": "output_off",
                        "name": "Output Off",
                        "enableCommands": "OUTP OFF",
                        "disableCommands": ""
                    }
                ],
                "signalModeConfigs": [
                    {"modeId": "output_on", "signalId": "voltage", "unit": "V", "scalingFactor": 1}
                ]
            })
        }
        
        # Mock monitoring setup with state machine
        setup = {
            "id": 1,
            "name": "Test Setup",
            "frequency_hz": 1.0,
            "initialStateID": "init",
            "states": [
                {
                    "id": "init",
                    "name": "Initial",
                    "isEndState": False,
                    "instrumentSettings": {
                        "1": {
                            "modeId": "output_off",
                            "modeParams": {}
                        }
                    }
                },
                {
                    "id": "running",
                    "name": "Running",
                    "isEndState": False,
                    "instrumentSettings": {
                        "1": {
                            "modeId": "output_on",
                            "modeParams": {"volts": 5.0, "amps": 1.0}
                        }
                    }
                },
                {
                    "id": "complete",
                    "name": "Complete",
                    "isEndState": True,
                    "instrumentSettings": {
                        "1": {
                            "modeId": "output_off",
                            "modeParams": {}
                        }
                    }
                }
            ],
            "transitions": [
                {
                    "id": "init_to_running",
                    "sourceStateID": "init",
                    "targetStateID": "running",
                    "rules": [
                        {"type": "timeInState", "seconds": 2}
                    ]
                },
                {
                    "id": "running_to_complete",
                    "sourceStateID": "running",
                    "targetStateID": "complete",
                    "rules": [
                        {"type": "sensor", "signalName": "Voltage", "operator": ">=", "value": 4.5}
                    ]
                }
            ]
        }
        
        storage.get_monitoring_setup.return_value = setup
        storage.get_instrument.return_value = instrument
        storage.get_instruments.return_value = [instrument]
        
        mock.return_value = storage
        yield storage


@pytest.fixture
def mock_vxi11_client():
    """Mock VXI-11 client."""
    with patch("app.services.state_machine_engine.get_vxi11_client") as mock:
        client = AsyncMock()
        client.write = AsyncMock()
        client.query = AsyncMock(return_value="5.0")
        mock.return_value = client
        yield client


@pytest.fixture
def mock_data_collector():
    """Mock data collector."""
    collector = MagicMock(spec=DataCollector)
    collector.start_monitoring = MagicMock()
    collector.stop_monitoring = MagicMock()
    collector.disable_mode_for_setup = AsyncMock()
    collector.collect_from_setup = AsyncMock(return_value={
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "setup_id": 1,
        "readings": {
            "Voltage": {"value": 5.0, "unit": "V"}
        }
    })
    return collector


@pytest.mark.asyncio
class TestStateMachineSession:
    """Test StateMachineSession behavior."""

    async def test_load_setup_success(self, mock_storage, mock_data_collector):
        """Test that setup loads correctly."""
        session = StateMachineSession(1, mock_data_collector)
        success = session._load_setup()
        
        assert success is True
        assert len(session.states_by_id) == 3
        assert "init" in session.states_by_id
        assert "running" in session.states_by_id
        assert "complete" in session.states_by_id
        assert len(session.transitions) == 2

    async def test_load_setup_no_states(self, mock_storage, mock_data_collector):
        """Test that load fails when setup has no states."""
        mock_storage.get_monitoring_setup.return_value = {
            "id": 1,
            "states": [],
            "transitions": []
        }
        
        session = StateMachineSession(1, mock_data_collector)
        success = session._load_setup()
        
        assert success is False

    async def test_get_initial_state_id(self, mock_storage, mock_data_collector):
        """Test retrieval of initial state ID."""
        session = StateMachineSession(1, mock_data_collector)
        session._load_setup()
        
        initial_id = session._get_initial_state_id()
        assert initial_id == "init"

    async def test_is_end_state(self, mock_storage, mock_data_collector):
        """Test identification of end states."""
        session = StateMachineSession(1, mock_data_collector)
        session._load_setup()
        
        assert session._is_end_state("complete") is True
        assert session._is_end_state("init") is False
        assert session._is_end_state("running") is False

    async def test_apply_state_settings(self, mock_storage, mock_vxi11_client, mock_data_collector):
        """Test that instrument settings are applied when entering a state."""
        session = StateMachineSession(1, mock_data_collector)
        session._load_setup()
        
        await session._apply_state_settings("running")
        
        # Verify VXI-11 commands were sent
        assert mock_vxi11_client.write.call_count == 3
        calls = [call[0][0] for call in mock_vxi11_client.write.call_args_list]
        assert "OUTP ON" in calls
        assert "VOLT 5.0" in calls
        assert "CURR 1.0" in calls

    async def test_evaluate_time_in_state_rule(self, mock_storage, mock_data_collector):
        """Test time-in-state rule evaluation."""
        session = StateMachineSession(1, mock_data_collector)
        session.state_entered_at = datetime.utcnow()
        
        # Rule requiring 2 seconds
        rule = {"type": "timeInState", "seconds": 2}
        
        # Should not trigger immediately
        result = session._evaluate_time_in_state_rule(rule)
        assert result is False
        
        # Mock time passage
        from datetime import timedelta
        session.state_entered_at = datetime.utcnow() - timedelta(seconds=3)
        result = session._evaluate_time_in_state_rule(rule)
        assert result is True

    async def test_evaluate_total_time_rule(self, mock_storage, mock_data_collector):
        """Test total-time rule evaluation."""
        session = StateMachineSession(1, mock_data_collector)
        session.session_started_at = datetime.utcnow()
        
        # Rule requiring 5 seconds
        rule = {"type": "totalTime", "seconds": 5}
        
        # Should not trigger immediately
        result = session._evaluate_total_time_rule(rule)
        assert result is False
        
        # Mock time passage
        from datetime import timedelta
        session.session_started_at = datetime.utcnow() - timedelta(seconds=6)
        result = session._evaluate_total_time_rule(rule)
        assert result is True

    async def test_evaluate_sensor_rule(self, mock_storage, mock_data_collector):
        """Test sensor rule evaluation with various operators."""
        session = StateMachineSession(1, mock_data_collector)
        session.setup_id = 1
        
        # Mock reading with voltage = 5.0
        mock_data_collector.collect_from_setup.return_value = {
            "readings": {"Voltage": {"value": 5.0}}
        }
        
        # Test > operator
        rule = {"type": "sensor", "signalName": "Voltage", "operator": ">", "value": 4.0}
        result = await session._evaluate_sensor_rule(rule)
        assert result is True
        
        rule = {"type": "sensor", "signalName": "Voltage", "operator": ">", "value": 6.0}
        result = await session._evaluate_sensor_rule(rule)
        assert result is False
        
        # Test >= operator
        rule = {"type": "sensor", "signalName": "Voltage", "operator": ">=", "value": 5.0}
        result = await session._evaluate_sensor_rule(rule)
        assert result is True
        
        # Test < operator
        rule = {"type": "sensor", "signalName": "Voltage", "operator": "<", "value": 6.0}
        result = await session._evaluate_sensor_rule(rule)
        assert result is True
        
        # Test == operator
        rule = {"type": "sensor", "signalName": "Voltage", "operator": "==", "value": 5.0}
        result = await session._evaluate_sensor_rule(rule)
        assert result is True

    async def test_check_transitions_no_match(self, mock_storage, mock_data_collector):
        """Test that no transition occurs when rules not satisfied."""
        session = StateMachineSession(1, mock_data_collector)
        session._load_setup()
        session.current_state_id = "init"
        session.state_entered_at = datetime.utcnow()
        
        # Time rule requires 2 seconds but we just entered
        target = await session._check_transitions()
        assert target is None

    async def test_check_transitions_match(self, mock_storage, mock_data_collector):
        """Test that transition occurs when rules are satisfied."""
        from datetime import timedelta
        
        session = StateMachineSession(1, mock_data_collector)
        session._load_setup()
        session.current_state_id = "init"
        session.state_entered_at = datetime.utcnow() - timedelta(seconds=3)
        
        # Time rule requires 2 seconds and we've been in state for 3
        target = await session._check_transitions()
        assert target == "running"

    async def test_transition_to_state(self, mock_storage, mock_vxi11_client, mock_data_collector):
        """Test transitioning to a new state."""
        session = StateMachineSession(1, mock_data_collector)
        session._load_setup()
        session.current_state_id = "init"
        
        await session._transition_to("running")
        
        assert session.current_state_id == "running"
        assert session.state_entered_at is not None
        assert mock_vxi11_client.write.call_count > 0

    async def test_transition_to_end_state_stops_session(
        self, mock_storage, mock_vxi11_client, mock_data_collector
    ):
        """Test that transitioning to end state stops the session."""
        session = StateMachineSession(1, mock_data_collector)
        session._load_setup()
        session.is_running = True
        session.current_state_id = "running"
        
        await session._transition_to("complete")
        
        assert session.current_state_id == "complete"
        assert session.is_running is False

    async def test_start_session_success(self, mock_storage, mock_vxi11_client, mock_data_collector):
        """Test successful session start."""
        session = StateMachineSession(1, mock_data_collector)
        
        success = await session.start()
        
        assert success is True
        assert session.is_running is True
        assert session.current_state_id == "init"
        assert session.session_started_at is not None
        assert session.state_entered_at is not None
        mock_data_collector.start_monitoring.assert_called_once_with(1)

    async def test_start_session_no_initial_state(self, mock_storage, mock_data_collector):
        """Test that start fails when no initial state defined."""
        mock_storage.get_monitoring_setup.return_value = {
            "id": 1,
            "initialStateID": None,
            "states": [{"id": "test", "name": "Test"}],
            "transitions": []
        }
        
        session = StateMachineSession(1, mock_data_collector)
        success = await session.start()
        
        assert success is False
        assert session.is_running is False

    async def test_start_session_invalid_initial_state(self, mock_storage, mock_data_collector):
        """Test that start fails when initial state doesn't exist."""
        mock_storage.get_monitoring_setup.return_value = {
            "id": 1,
            "initialStateID": "nonexistent",
            "states": [{"id": "test", "name": "Test"}],
            "transitions": []
        }
        
        session = StateMachineSession(1, mock_data_collector)
        success = await session.start()
        
        assert success is False

    async def test_stop_session(self, mock_storage, mock_vxi11_client, mock_data_collector):
        """Test session stop."""
        session = StateMachineSession(1, mock_data_collector)
        await session.start()
        
        await session.stop()
        
        assert session.is_running is False
        mock_data_collector.stop_monitoring.assert_called_once_with(1)
        mock_data_collector.disable_mode_for_setup.assert_called_once_with(1)

    async def test_get_status(self, mock_storage, mock_vxi11_client, mock_data_collector):
        """Test status reporting."""
        session = StateMachineSession(1, mock_data_collector)
        await session.start()
        
        status = session.get_status()
        
        assert status["setup_id"] == 1
        assert status["is_running"] is True
        assert status["current_state_id"] == "init"
        assert status["session_started_at"] is not None
        assert status["state_entered_at"] is not None
        assert status["time_in_current_state"] is not None
        assert status["total_session_time"] is not None


@pytest.mark.asyncio
class TestStateMachineEngine:
    """Test StateMachineEngine functionality."""

    async def test_start_session(self, mock_storage, mock_vxi11_client, mock_data_collector):
        """Test starting a new session via engine."""
        with patch("app.services.state_machine_engine.get_data_collector", return_value=mock_data_collector):
            engine = StateMachineEngine()
            
            success = await engine.start_session(1)
            
            assert success is True
            assert 1 in engine.sessions
            assert engine.sessions[1].is_running is True

    async def test_start_session_replaces_existing(
        self, mock_storage, mock_vxi11_client, mock_data_collector
    ):
        """Test that starting a session stops any existing session for that setup."""
        with patch("app.services.state_machine_engine.get_data_collector", return_value=mock_data_collector):
            engine = StateMachineEngine()
            
            # Start first session
            await engine.start_session(1)
            first_session = engine.sessions[1]
            
            # Start second session (should replace)
            await engine.start_session(1)
            second_session = engine.sessions[1]
            
            assert first_session is not second_session
            assert first_session.is_running is False
            assert second_session.is_running is True

    async def test_stop_session(self, mock_storage, mock_vxi11_client, mock_data_collector):
        """Test stopping a session via engine."""
        with patch("app.services.state_machine_engine.get_data_collector", return_value=mock_data_collector):
            engine = StateMachineEngine()
            
            await engine.start_session(1)
            success = await engine.stop_session(1)
            
            assert success is True
            assert 1 not in engine.sessions

    async def test_stop_nonexistent_session(self, mock_data_collector):
        """Test stopping a session that doesn't exist."""
        with patch("app.services.state_machine_engine.get_data_collector", return_value=mock_data_collector):
            engine = StateMachineEngine()
            
            success = await engine.stop_session(999)
            
            assert success is False

    async def test_get_session_status(self, mock_storage, mock_vxi11_client, mock_data_collector):
        """Test getting session status."""
        with patch("app.services.state_machine_engine.get_data_collector", return_value=mock_data_collector):
            engine = StateMachineEngine()
            
            await engine.start_session(1)
            status = engine.get_session_status(1)
            
            assert status is not None
            assert status["setup_id"] == 1
            assert status["is_running"] is True

    async def test_get_session_status_nonexistent(self, mock_data_collector):
        """Test getting status of nonexistent session."""
        with patch("app.services.state_machine_engine.get_data_collector", return_value=mock_data_collector):
            engine = StateMachineEngine()
            
            status = engine.get_session_status(999)
            
            assert status is None

    async def test_get_all_sessions_status(
        self, mock_storage, mock_vxi11_client, mock_data_collector
    ):
        """Test getting status of all sessions."""
        with patch("app.services.state_machine_engine.get_data_collector", return_value=mock_data_collector):
            engine = StateMachineEngine()
            
            # Create separate mock setups for each ID
            base_setup = mock_storage.get_monitoring_setup.return_value.copy()
            
            def get_setup(setup_id):
                setup = base_setup.copy()
                setup["id"] = setup_id
                return setup
            
            mock_storage.get_monitoring_setup.side_effect = get_setup
            
            await engine.start_session(1)
            await engine.start_session(2)
            
            statuses = engine.get_all_sessions_status()
            
            assert len(statuses) == 2
            assert any(s["setup_id"] == 1 for s in statuses)
            assert any(s["setup_id"] == 2 for s in statuses)

    async def test_stop_all_sessions(self, mock_storage, mock_vxi11_client, mock_data_collector):
        """Test stopping all sessions."""
        with patch("app.services.state_machine_engine.get_data_collector", return_value=mock_data_collector):
            engine = StateMachineEngine()
            
            # Create separate mock setups for each ID
            base_setup = mock_storage.get_monitoring_setup.return_value.copy()
            
            def get_setup(setup_id):
                setup = base_setup.copy()
                setup["id"] = setup_id
                return setup
            
            mock_storage.get_monitoring_setup.side_effect = get_setup
            
            await engine.start_session(1)
            await engine.start_session(2)
            
            await engine.stop_all_sessions()
            
            assert len(engine.sessions) == 0


@pytest.mark.asyncio
class TestStateMachineIntegration:
    """Integration tests for complete state machine workflows."""

    async def test_complete_workflow(self, mock_storage, mock_vxi11_client, mock_data_collector):
        """Test a complete workflow from start to end state."""
        from datetime import timedelta
        
        with patch("app.services.state_machine_engine.get_data_collector", return_value=mock_data_collector):
            session = StateMachineSession(1, mock_data_collector)
            
            # Start session
            await session.start()
            assert session.current_state_id == "init"
            
            # Simulate time passage for transition to "running"
            session.state_entered_at = datetime.utcnow() - timedelta(seconds=3)
            target = await session._check_transitions()
            assert target == "running"
            
            # Execute transition
            await session._transition_to("running")
            assert session.current_state_id == "running"
            
            # Mock sensor reading that satisfies rule
            mock_data_collector.collect_from_setup.return_value = {
                "readings": {"Voltage": {"value": 5.0}}
            }
            
            # Check for transition to complete
            target = await session._check_transitions()
            assert target == "complete"
            
            # Execute transition to end state
            await session._transition_to("complete")
            assert session.current_state_id == "complete"
            assert session.is_running is False

    async def test_multi_rule_transition(self, mock_storage, mock_vxi11_client, mock_data_collector):
        """Test transition with multiple rules (AND logic)."""
        from datetime import timedelta
        
        # Modify setup to have multi-rule transition
        setup = mock_storage.get_monitoring_setup(1)
        setup["transitions"][1]["rules"] = [
            {"type": "sensor", "signalName": "Voltage", "operator": ">=", "value": 4.5},
            {"type": "timeInState", "seconds": 1}
        ]
        
        with patch("app.services.state_machine_engine.get_data_collector", return_value=mock_data_collector):
            session = StateMachineSession(1, mock_data_collector)
            session._load_setup()
            session.current_state_id = "running"
            session.state_entered_at = datetime.utcnow()
            
            # Mock good sensor reading but not enough time
            mock_data_collector.collect_from_setup.return_value = {
                "readings": {"Voltage": {"value": 5.0}}
            }
            
            target = await session._check_transitions()
            assert target is None  # Not enough time
            
            # Now with enough time
            session.state_entered_at = datetime.utcnow() - timedelta(seconds=2)
            target = await session._check_transitions()
            assert target == "complete"  # Both rules satisfied

    async def test_multiple_transitions_matched_takes_first(
        self, mock_storage, mock_vxi11_client, mock_data_collector
    ):
        """Test that when multiple transitions match, only the first one is taken."""
        from datetime import timedelta
        
        # Modify setup to have multiple transitions from same state, all satisfied
        setup = mock_storage.get_monitoring_setup(1)
        setup["states"].append({
            "id": "alternate",
            "name": "Alternate Path",
            "isEndState": False,
            "instrumentSettings": {
                "1": {"modeId": "output_off", "modeParams": {}}
            }
        })
        
        # Add multiple transitions from "running" that will all be satisfied
        setup["transitions"] = [
            {
                "id": "running_to_complete",
                "sourceStateID": "running",
                "targetStateID": "complete",
                "rules": [
                    {"type": "sensor", "signalName": "Voltage", "operator": ">=", "value": 4.5}
                ]
            },
            {
                "id": "running_to_alternate",
                "sourceStateID": "running",
                "targetStateID": "alternate",
                "rules": [
                    {"type": "timeInState", "seconds": 1}
                ]
            },
            {
                "id": "running_to_complete_time",
                "sourceStateID": "running",
                "targetStateID": "complete",
                "rules": [
                    {"type": "totalTime", "seconds": 1}
                ]
            }
        ]
        
        with patch("app.services.state_machine_engine.get_data_collector", return_value=mock_data_collector):
            session = StateMachineSession(1, mock_data_collector)
            session._load_setup()
            
            # Set up timing so all transitions are satisfied
            session.current_state_id = "running"
            session.state_entered_at = datetime.utcnow() - timedelta(seconds=2)
            session.session_started_at = datetime.utcnow() - timedelta(seconds=2)
            
            # Mock sensor reading that satisfies first rule
            mock_data_collector.collect_from_setup.return_value = {
                "readings": {"Voltage": {"value": 5.0}}
            }
            
            # Check transitions - should return first match only
            target = await session._check_transitions()
            
            # Should take the first transition (running_to_complete)
            assert target == "complete"
            
            # Execute the transition
            previous_state = session.current_state_id
            await session._transition_to(target)
            
            # Verify we transitioned to the first matched target
            assert session.current_state_id == "complete"
            assert session.current_state_id != "alternate"  # Not the second option
            
            # Verify we only transitioned once
            assert previous_state != session.current_state_id
