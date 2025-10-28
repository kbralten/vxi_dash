"""API routes for state machine control."""
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, HTTPException, status

from app.services.state_machine_engine import get_state_machine_engine

router = APIRouter(prefix="/state-machine", tags=["state-machine"])


@router.post("/{setup_id}/start", response_model=Dict[str, Any])
async def start_state_machine(setup_id: int) -> Dict[str, Any]:
    """Start a state machine session for a monitoring setup.
    
    This will:
    1. Load the setup's state machine definition
    2. Transition to the initial state
    3. Apply the initial state's instrument settings
    4. Begin monitoring and rule evaluation
    """
    engine = get_state_machine_engine()
    
    success = await engine.start_session(setup_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Failed to start state machine. Check that setup has valid initial state."
        )
    
    status_info = engine.get_session_status(setup_id)
    return {
        "message": "State machine started",
        "status": status_info
    }


@router.post("/{setup_id}/stop", response_model=Dict[str, Any])
async def stop_state_machine(setup_id: int) -> Dict[str, Any]:
    """Stop a running state machine session.
    
    This will:
    1. Stop the state machine loop
    2. Stop data monitoring
    3. Disable instrument modes
    """
    engine = get_state_machine_engine()
    
    success = await engine.stop_session(setup_id)
    
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active state machine session found"
        )
    
    return {
        "message": "State machine stopped",
        "setup_id": setup_id
    }


@router.get("/{setup_id}/status", response_model=Dict[str, Any])
async def get_state_machine_status(setup_id: int) -> Dict[str, Any]:
    """Get the current status of a state machine session."""
    engine = get_state_machine_engine()
    
    status_info = engine.get_session_status(setup_id)
    
    if status_info is None:
        return {
            "setup_id": setup_id,
            "is_running": False,
            "current_state_id": None,
            "session_started_at": None,
            "state_entered_at": None,
            "time_in_current_state": None,
            "total_session_time": None,
        }
    
    return status_info


@router.get("/", response_model=List[Dict[str, Any]])
async def list_all_sessions() -> List[Dict[str, Any]]:
    """Get status of all active state machine sessions."""
    engine = get_state_machine_engine()
    return engine.get_all_sessions_status()
