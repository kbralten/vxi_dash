from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, status

from app.storage import get_storage

router = APIRouter(prefix="/monitoring", tags=["monitoring"])


@router.get("/", response_model=List[Dict[str, Any]])
async def list_monitoring_configurations() -> List[Dict[str, Any]]:
    storage = get_storage()
    setups = storage.get_monitoring_setups()
    
    # Enrich with instrument data for single or multi-instrument setups
    instruments = storage.get_instruments()
    instruments_by_id = {inst["id"]: inst for inst in instruments}

    for setup in setups:
        # Backward compatibility: single instrument fields
        instrument_id = setup.get("instrument_id")
        if instrument_id:
            setup["instrument"] = instruments_by_id.get(instrument_id)
        else:
            setup["instrument"] = None

        # New shape: instruments: [{ instrument_id, parameters, instrument? }]
        targets = setup.get("instruments") or []
        enriched_targets: List[Dict[str, Any]] = []
        for t in targets:
            tid = t.get("instrument_id")
            enriched = dict(t)
            enriched["instrument"] = instruments_by_id.get(tid)
            enriched_targets.append(enriched)
        if enriched_targets:
            setup["instruments"] = enriched_targets
    
    return setups


@router.post("/", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_monitoring_configuration(payload: Dict[str, Any]) -> Dict[str, Any]:
    storage = get_storage()
    
    # Normalize payload to multi-instrument shape if single fields are used
    if "instruments" not in payload and "instrument_id" in payload:
        payload = dict(payload)
        payload["instruments"] = [{
            "instrument_id": payload.pop("instrument_id"),
            "parameters": payload.pop("parameters", {})
        }]

    # Validate instruments array
    targets = payload.get("instruments") or []
    if not isinstance(targets, list) or len(targets) == 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one instrument must be specified")
    for t in targets:
        tid = t.get("instrument_id")
        if tid is None or storage.get_instrument(int(tid)) is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Instrument not found: {tid}")

    # Check if name is unique
    setups = storage.get_monitoring_setups()
    if any(setup.get("name") == payload.get("name") for setup in setups):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Monitoring setup with name '{payload.get('name')}' already exists"
        )

    setup = storage.create_monitoring_setup(payload)
    
    # Enrich with instrument data (multi)
    instruments_by_id = {inst["id"]: inst for inst in storage.get_instruments()}
    if setup.get("instruments"):
        setup["instruments"] = [
            {**t, "instrument": instruments_by_id.get(t.get("instrument_id"))}
            for t in setup.get("instruments", [])
        ]
    
    return setup


@router.get("/{setup_id}", response_model=Dict[str, Any])
async def get_monitoring_configuration(setup_id: int) -> Dict[str, Any]:
    storage = get_storage()
    setup = storage.get_monitoring_setup(setup_id)
    if setup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitoring setup not found")
    
    # Enrich with instrument data (single + multi)
    instrument_id = setup.get("instrument_id")
    if instrument_id:
        setup["instrument"] = storage.get_instrument(instrument_id)
    targets = setup.get("instruments") or []
    if targets:
        instruments_by_id = {inst["id"]: inst for inst in storage.get_instruments()}
        setup["instruments"] = [
            {**t, "instrument": instruments_by_id.get(t.get("instrument_id"))}
            for t in targets
        ]
    
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
    # Normalize single fields to multi on update too
    if "instruments" not in payload and "instrument_id" in payload:
        payload = dict(payload)
        payload["instruments"] = [{
            "instrument_id": payload.pop("instrument_id"),
            "parameters": payload.pop("parameters", {})
        }]
    # Validate instruments if provided
    if "instruments" in payload:
        targets = payload.get("instruments") or []
        if not isinstance(targets, list) or len(targets) == 0:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="At least one instrument must be specified")
        for t in targets:
            tid = t.get("instrument_id")
            if tid is None or storage.get_instrument(int(tid)) is None:
                raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Instrument not found: {tid}")
    
    setup = storage.update_monitoring_setup(setup_id, payload)
    if setup is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitoring setup not found")
    
    # Enrich with instrument data
    instrument_id = setup.get("instrument_id")
    if instrument_id:
        setup["instrument"] = storage.get_instrument(instrument_id)
    if setup.get("instruments"):
        instruments_by_id = {inst["id"]: inst for inst in storage.get_instruments()}
        setup["instruments"] = [
            {**t, "instrument": instruments_by_id.get(t.get("instrument_id"))}
            for t in setup.get("instruments", [])
        ]
    
    return setup


@router.delete("/{setup_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_monitoring_configuration(setup_id: int) -> None:
    storage = get_storage()
    if not storage.delete_monitoring_setup(setup_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Monitoring setup not found")
