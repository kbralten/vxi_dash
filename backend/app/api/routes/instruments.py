from typing import Any, Dict, List

from fastapi import APIRouter, HTTPException, status
from pydantic import BaseModel

from app.storage import get_storage
from app.services.vxi11_client import get_vxi11_client

router = APIRouter(prefix="/instruments", tags=["instruments"])


class CommandRequest(BaseModel):
    command: str


@router.get("/", response_model=List[Dict[str, Any]])
async def list_instruments() -> List[Dict[str, Any]]:
    storage = get_storage()
    return storage.get_instruments()


@router.post("/", response_model=Dict[str, Any], status_code=status.HTTP_201_CREATED)
async def create_instrument(payload: Dict[str, Any]) -> Dict[str, Any]:
    storage = get_storage()
    
    # Check if name is unique
    instruments = storage.get_instruments()
    if any(inst.get("name") == payload.get("name") for inst in instruments):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Instrument with name '{payload.get('name')}' already exists"
        )
    
    return storage.create_instrument(payload)


@router.get("/{instrument_id}", response_model=Dict[str, Any])
async def get_instrument(instrument_id: int) -> Dict[str, Any]:
    storage = get_storage()
    instrument = storage.get_instrument(instrument_id)
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")
    return instrument


@router.put("/{instrument_id}", response_model=Dict[str, Any])
async def update_instrument(instrument_id: int, payload: Dict[str, Any]) -> Dict[str, Any]:
    storage = get_storage()
    
    # Check if name is unique (if being updated)
    if "name" in payload:
        instruments = storage.get_instruments()
        if any(inst.get("id") != instrument_id and inst.get("name") == payload.get("name") for inst in instruments):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Instrument with name '{payload.get('name')}' already exists"
            )
    
    instrument = storage.update_instrument(instrument_id, payload)
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")
    return instrument


@router.delete("/{instrument_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_instrument(instrument_id: int) -> None:
    storage = get_storage()
    if not storage.delete_instrument(instrument_id):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")


@router.post("/{instrument_id}/command", response_model=Dict[str, str])
async def send_command(instrument_id: int, request: CommandRequest) -> Dict[str, str]:
    """Send a SCPI command to an instrument and return the response."""
    storage = get_storage()
    instrument = storage.get_instrument(instrument_id)
    if instrument is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Instrument not found")
    
    # Full address may be one of:
    # - host:port            -> raw TCP SCPI
    # - host                 -> VXI-11 RPC default device "inst0"
    # - host/device          -> VXI-11 RPC with specific device name
    address = instrument.get("address", "")

    try:
        # Get client based on address
        client = await get_vxi11_client(address)
        
        # Check if it's a query command (ends with ?)
        if request.command.strip().endswith("?"):
            response = await client.query(request.command)
        else:
            await client.write(request.command)
            response = "OK"
        
        return {"response": response}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Failed to execute command: {str(e)}"
        )
