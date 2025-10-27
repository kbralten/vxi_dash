"""
End-to-End test for the complete instrument workflow:
1. Create instrument with advanced configuration
2. Create monitoring setup
3. Connect to instrument and collect data
"""

import asyncio
import json
from typing import Any, Dict

import httpx
import pytest
from httpx import AsyncClient

from app.main import app
from app.services.vxi11_client import VXI11Client
from app.storage.file_storage import get_storage


@pytest.fixture(autouse=True)
def clean_storage():
    """Clean storage before and after each test."""
    storage = get_storage()
    # Clear instruments and monitoring setups by saving empty lists
    storage._save_json(storage.instruments_file, [])
    storage._save_json(storage.monitoring_file, [])
    yield
    # Clean up after test
    storage._save_json(storage.instruments_file, [])
    storage._save_json(storage.monitoring_file, [])


@pytest.mark.asyncio
async def test_complete_e2e_workflow(monkeypatch):
    """
    Test the complete end-to-end workflow:
    1. Create instrument with advanced configuration (signals, modes, matrix)
    2. Verify instrument was created
    3. Create monitoring setup
    4. Verify monitoring setup was created
    5. Connect to mock instrument
    6. Collect data based on configuration
    """
    
    # Enable mock mode for this E2E test since it targets a mock address
    monkeypatch.setenv("VXI11_ENABLE_MOCK", "true")

    async with AsyncClient(app=app, base_url="http://testserver") as client:
        # Step 1: Create instrument with advanced configuration
        instrument_config = {
            "signal": {
                "voltage": "MEAS:VOLT?",
                "current": "MEAS:CURR?",
                "power": "MEAS:POW?"
            },
            "mode": {
                "standby": {
                    "enable": "MODE STANDBY",
                    "disable": "MODE OFF",
                    "parameters": []
                },
                "run": {
                    "enable": "MODE RUN {frequency}",
                    "disable": "MODE STOP",
                    "parameters": ["frequency"]
                },
                "diagnostic": {
                    "enable": "MODE DIAG {level}",
                    "disable": "MODE NORMAL",
                    "parameters": ["level"]
                }
            },
            "signal_mode_config": {
                "voltage": {
                    "standby": {"unit": "V", "scale": 1.0},
                    "run": {"unit": "V", "scale": 1.0},
                    "diagnostic": {"unit": "mV", "scale": 1000.0}
                },
                "current": {
                    "standby": {"unit": "A", "scale": 1.0},
                    "run": {"unit": "A", "scale": 1.0},
                    "diagnostic": {"unit": "mA", "scale": 1000.0}
                },
                "power": {
                    "standby": {"unit": "W", "scale": 1.0},
                    "run": {"unit": "W", "scale": 1.0},
                    "diagnostic": {"unit": "mW", "scale": 1000.0}
                }
            }
        }
        
        instrument_data = {
            "name": "Test Power Supply",
            "address": "mock_instrument:9000/inst0",
            "description": json.dumps(instrument_config),
            "is_active": True
        }
        
        # Create instrument
        create_response = await client.post("/api/instruments/", json=instrument_data)
        assert create_response.status_code == 201, f"Failed to create instrument: {create_response.text}"
        created_instrument = create_response.json()
        instrument_id = created_instrument["id"]
        
        # Step 2: Verify instrument was created and has correct configuration
        get_response = await client.get(f"/api/instruments/{instrument_id}")
        assert get_response.status_code == 200
        instrument = get_response.json()
        assert instrument["name"] == "Test Power Supply"
        assert instrument["address"] == "mock_instrument:9000/inst0"
        assert instrument["is_active"] is True
        
        # Verify configuration is stored correctly
        stored_config = json.loads(instrument["description"])
        assert "voltage" in stored_config["signal"]
        assert "run" in stored_config["mode"]
        assert stored_config["mode"]["run"]["parameters"] == ["frequency"]
        
        # Step 3: Create monitoring setup
        monitoring_data = {
            "name": "Power Supply Monitoring",
            "frequency_hz": 1.0,
            "instrument_id": instrument_id,
            "parameters": json.dumps({
                "mode": "run",
                "mode_parameters": {
                    "frequency": "50Hz"
                },
                "signals": ["voltage", "current", "power"]
            })
        }
        
        monitoring_response = await client.post("/api/monitoring/", json=monitoring_data)
        assert monitoring_response.status_code == 201, f"Failed to create monitoring setup: {monitoring_response.text}"
        created_monitoring = monitoring_response.json()
        monitoring_id = created_monitoring["id"]
        
        # Step 4: Verify monitoring setup was created with enriched instrument data
        get_monitoring_response = await client.get(f"/api/monitoring/{monitoring_id}")
        assert get_monitoring_response.status_code == 200
        monitoring = get_monitoring_response.json()
        assert monitoring["name"] == "Power Supply Monitoring"
        assert monitoring["frequency_hz"] == 1.0
        assert monitoring["instrument_id"] == instrument_id
        
        # Verify instrument is enriched in response
        assert "instrument" in monitoring
        assert monitoring["instrument"]["name"] == "Test Power Supply"
        
        # Verify parameters are stored correctly
        stored_params = json.loads(monitoring["parameters"])
        assert stored_params["mode"] == "run"
        assert stored_params["mode_parameters"]["frequency"] == "50Hz"
        assert "voltage" in stored_params["signals"]
        
    # Step 5: Test VXI-11 connection to mock instrument
    # Parse address (format: host:port/identifier)
    address_parts = instrument["address"].split("/")
    host_port = address_parts[0]
    
    client = VXI11Client(host_port)
    
    # Step 6: Simulate data collection based on configuration
    config = json.loads(instrument["description"])
    params = json.loads(monitoring["parameters"])
    
    # Enable the mode
    mode = params["mode"]
    mode_config = config["mode"][mode]
    enable_command = mode_config["enable"]
    
    # Replace parameters in enable command
    for param_name, param_value in params.get("mode_parameters", {}).items():
        enable_command = enable_command.replace(f"{{{param_name}}}", param_value)
    
    # Send enable command
    await client.write(enable_command)
    
    # Collect data for each signal
    collected_data = {}
    for signal_name in params["signals"]:
        # Get the measure command for this signal
        measure_command = config["signal"][signal_name]
        
        # Query the instrument
        response = await client.query(measure_command)
        
        # Get scaling info for this signal and mode
        signal_config = config["signal_mode_config"][signal_name][mode]
        unit = signal_config["unit"]
        scale = signal_config["scale"]
        
        collected_data[signal_name] = {
            "raw_response": response,
            "unit": unit,
            "scale": scale,
            "command": measure_command
        }
    
    # Verify data was collected for all signals
    assert "voltage" in collected_data
    assert "current" in collected_data
    assert "power" in collected_data
    
    # Verify scaling configuration is applied
    assert collected_data["voltage"]["unit"] == "V"
    assert collected_data["voltage"]["scale"] == 1.0
    assert collected_data["current"]["unit"] == "A"
    assert collected_data["power"]["unit"] == "W"
    
    # Step 7: Test different mode
    params["mode"] = "diagnostic"
    params["mode_parameters"] = {"level": "verbose"}
    
    mode = params["mode"]
    mode_config = config["mode"][mode]
    enable_command = mode_config["enable"]
    
    for param_name, param_value in params["mode_parameters"].items():
        enable_command = enable_command.replace(f"{{{param_name}}}", param_value)
    
    await client.write(enable_command)
    
    # Collect data in diagnostic mode
    diagnostic_data = {}
    for signal_name in params["signals"]:
        measure_command = config["signal"][signal_name]
        response = await client.query(measure_command)
        
        signal_config = config["signal_mode_config"][signal_name][mode]
        diagnostic_data[signal_name] = {
            "raw_response": response,
            "unit": signal_config["unit"],
            "scale": signal_config["scale"]
        }
    
    # Verify units changed in diagnostic mode (should be mV, mA, mW)
    assert diagnostic_data["voltage"]["unit"] == "mV"
    assert diagnostic_data["voltage"]["scale"] == 1000.0
    assert diagnostic_data["current"]["unit"] == "mA"
    assert diagnostic_data["power"]["unit"] == "mW"


@pytest.mark.asyncio
async def test_multiple_instruments_monitoring():
    """
    Test monitoring multiple instruments simultaneously.
    """
    async with AsyncClient(app=app, base_url="http://testserver") as client:
        # Create first instrument
        instrument1_config = {
            "signal": {"voltage": "MEAS:VOLT?"},
            "mode": {"standby": {"enable": "MODE STANDBY", "disable": "MODE OFF", "parameters": []}},
            "signal_mode_config": {
                "voltage": {"standby": {"unit": "V", "scale": 1.0}}
            }
        }
        
        instrument1_data = {
            "name": "Instrument 1",
            "address": "mock_instrument:9000/inst1",
            "description": json.dumps(instrument1_config),
            "is_active": True
        }
        
        response1 = await client.post("/api/instruments/", json=instrument1_data)
        assert response1.status_code == 201
        inst1_id = response1.json()["id"]
        
        # Create second instrument
        instrument2_config = {
            "signal": {"current": "MEAS:CURR?"},
            "mode": {"run": {"enable": "MODE RUN", "disable": "MODE STOP", "parameters": []}},
            "signal_mode_config": {
                "current": {"run": {"unit": "A", "scale": 1.0}}
            }
        }
        
        instrument2_data = {
            "name": "Instrument 2",
            "address": "mock_instrument:9000/inst2",
            "description": json.dumps(instrument2_config),
            "is_active": True
        }
        
        response2 = await client.post("/api/instruments/", json=instrument2_data)
        assert response2.status_code == 201
        inst2_id = response2.json()["id"]
        
        # Create monitoring setup for first instrument
        monitoring1_data = {
            "name": "Monitor Instrument 1",
            "frequency_hz": 2.0,
            "instrument_id": inst1_id,
            "parameters": json.dumps({
                "mode": "standby",
                "signals": ["voltage"]
            })
        }
        
        mon1_response = await client.post("/api/monitoring/", json=monitoring1_data)
        assert mon1_response.status_code == 201
        
        # Create monitoring setup for second instrument
        monitoring2_data = {
            "name": "Monitor Instrument 2",
            "frequency_hz": 5.0,
            "instrument_id": inst2_id,
            "parameters": json.dumps({
                "mode": "run",
                "signals": ["current"]
            })
        }
        
        mon2_response = await client.post("/api/monitoring/", json=monitoring2_data)
        assert mon2_response.status_code == 201
        
        # List all monitoring setups
        list_response = await client.get("/api/monitoring/")
        assert list_response.status_code == 200
        all_setups = list_response.json()
        
        assert len(all_setups) == 2
        
        # Verify both have enriched instrument data
        setup_names = {setup["name"] for setup in all_setups}
        assert "Monitor Instrument 1" in setup_names
        assert "Monitor Instrument 2" in setup_names
        
        for setup in all_setups:
            assert "instrument" in setup
            assert setup["instrument"]["name"] in ["Instrument 1", "Instrument 2"]


@pytest.mark.asyncio
async def test_instrument_validation_and_crud():
    """
    Test instrument CRUD operations and validation.
    """
    async with AsyncClient(app=app, base_url="http://testserver") as client:
        # Create instrument
        instrument_config = {
            "signal": {"temp": "MEAS:TEMP?"},
            "mode": {"normal": {"enable": "MODE NORMAL", "disable": "MODE OFF", "parameters": []}},
            "signal_mode_config": {"temp": {"normal": {"unit": "C", "scale": 1.0}}}
        }
        
        instrument_data = {
            "name": "Temperature Sensor",
            "address": "192.168.1.100:1024/temp",
            "description": json.dumps(instrument_config),
            "is_active": True
        }
        
        # Create
        create_response = await client.post("/api/instruments/", json=instrument_data)
        assert create_response.status_code == 201
        instrument_id = create_response.json()["id"]
        
        # Test unique name validation - should fail
        duplicate_response = await client.post("/api/instruments/", json=instrument_data)
        assert duplicate_response.status_code == 400
        assert "already exists" in duplicate_response.json()["detail"].lower()
        
        # Read
        get_response = await client.get(f"/api/instruments/{instrument_id}")
        assert get_response.status_code == 200
        
        # Update
        update_data = {
            "name": "Updated Temperature Sensor",
            "address": "192.168.1.101:1024/temp",
            "description": json.dumps(instrument_config),
            "is_active": False
        }
        
        update_response = await client.put(f"/api/instruments/{instrument_id}", json=update_data)
        assert update_response.status_code == 200
        updated = update_response.json()
        assert updated["name"] == "Updated Temperature Sensor"
        assert updated["is_active"] is False
        
        # List
        list_response = await client.get("/api/instruments/")
        assert list_response.status_code == 200
        instruments = list_response.json()
        assert len(instruments) == 1
        
        # Delete
        delete_response = await client.delete(f"/api/instruments/{instrument_id}")
        assert delete_response.status_code == 204
        
        # Verify deleted
        get_after_delete = await client.get(f"/api/instruments/{instrument_id}")
        assert get_after_delete.status_code == 404


@pytest.mark.asyncio
async def test_monitoring_with_vxi11_mock(monkeypatch):
    """Test connecting via VXI-11 path using the built-in mock client for mock addresses."""
    # Enable mock mode for this test
    monkeypatch.setenv("VXI11_ENABLE_MOCK", "true")
    async with AsyncClient(app=app, base_url="http://testserver") as client:
        # Create instrument pointing to mock VXI-11 address (handled by MockVXI11Client)
        instrument_config = {
            "signal": {"voltage": "MEAS:VOLT?", "current": "MEAS:CURR?"},
            "mode": {"standby": {"enable": "MODE STANDBY", "disable": "MODE OFF", "parameters": []}},
            "signal_mode_config": {
                "voltage": {"standby": {"unit": "V", "scale": 1.0}},
                "current": {"standby": {"unit": "A", "scale": 1.0}}
            }
        }

        instrument_data = {
            "name": "Mock VXI11 Instrument",
            "address": "mock_instrument/inst0",
            "description": json.dumps(instrument_config),
            "is_active": True
        }

        create_response = await client.post("/api/instruments/", json=instrument_data)
        assert create_response.status_code == 201
        instrument = create_response.json()

        # Exercise the command endpoint through the backend
        cmd_resp = await client.post(f"/api/instruments/{instrument['id']}/command", json={"command": "*IDN?"})
        assert cmd_resp.status_code == 200
        data = cmd_resp.json()
        assert "response" in data
        assert "Mock response" in data["response"]
