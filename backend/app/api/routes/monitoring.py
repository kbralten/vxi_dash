from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, status

from app.storage import get_storage

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/", response_model=List[Dict[str, Any]])
async def list_monitoring_configurations() -> List[Dict[str, Any]]:
    storage = get_storage()
    setups = storage.get_monitoring_setups()
    
    # Enrich with instrument data
    instruments = storage.get_instruments()
    instruments_by_id = {inst["id"]: inst for inst in instruments}
    
    for setup in setups:
        instrument_id = setup.get("instrument_id")
        if instrument_id and instrument_id in instruments_by_id:
            setup["instrument"] = instruments_by_id[instrument_id]
        else:
            setup["instrument"] = None
    
    return setups


@router.post("/", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_monitoring_configuration(payload: Dict[str, Any]) -> Dict[str, Any]:
    storage = get_storage()
    
    # Check if instrument exists
    instrument_id = payload.get("instrument_id")
    if instrument_id and storage.get_instrument(instrument_id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")

    # Check if name is unique
    setups = storage.get_monitoring_setups()
    if any(setup.get("name") == payload.get("name") for setup in setups):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Monitoring setup with name '{payload.get('name')}' already exists"
        )

    setup = storage.create_monitoring_setup(payload)
    
    # Enrich with instrument data
    if instrument_id:
        instrument = storage.get_instrument(instrument_id)
        setup["instrument"] = instrument
    
    return setup


@router.get("/{setup_id}", response_model=Dict[str, Any])
async def get_monitoring_configuration(setup_id: int) -> Dict[str, Any]:
    storage = get_storage()
    setup = storage.get_monitoring_setup(setup_id)
    if setup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitoring setup not found")
    
    # Enrich with instrument data
    instrument_id = setup.get("instrument_id")
    if instrument_id:
        setup["instrument"] = storage.get_instrument(instrument_id)
    
    return setup


@router.put("/{setup_id}", response_model=Dict[str, Any])
async def update_monitoring_configuration(setup_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    storage = get_storage()
    
    # Check if name is unique (if being updated)
    if "name" in payload:
        setups = storage.get_monitoring_setups()
        if any(setup.get("id") != setup_id and setup.get("name") == payload.get("name") for setup in setups):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Monitoring setup with name '{payload.get('name')}' already exists"
            )
    
    setup = storage.update_monitoring_setup(setup_id, payload)
    if setup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitoring setup not found")
    
    # Enrich with instrument data
    instrument_id = setup.get("instrument_id")
    if instrument_id:
        setup["instrument"] = storage.get_instrument(instrument_id)
    
    return setup


@router.delete("/{setup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_monitoring_configuration(setup_id: int) -> None:
    storage = get_storage()
    if not storage.delete_monitoring_setup(setup_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitoring setup not found")
