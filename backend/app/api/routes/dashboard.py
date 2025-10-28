from datetime import datetime, timedelta
from typing import Any, Dict, List, Tuple, DefaultDict

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
import csv
import io
from collections import defaultdict

from app.services.data_collector import get_data_collector
from app.storage import get_storage

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/summary")
async def dashboard_summary() -> Dict[str, Any]:
    """Get dashboard summary with monitoring setups and instruments."""
    storage = get_storage()
    setups = storage.get_monitoring_setups()
    instruments = storage.get_instruments()
    
    # Build instrument lookup
    instruments_by_id = {inst["id"]: inst for inst in instruments}
    
    # Enrich setups with instrument data (single + multi)
    for setup in setups:
        instrument_id = setup.get("instrument_id")
        if instrument_id and instrument_id in instruments_by_id:
            setup["instrument"] = instruments_by_id[instrument_id]
        else:
            setup["instrument"] = None
        targets = setup.get("instruments") or []
        if targets:
            setup["instruments"] = [
                {**t, "instrument": instruments_by_id.get(t.get("instrument_id"))}
                for t in targets
            ]
    
    active_count = len(setups)
    # Count unique instruments across single + multi shapes
    unique_instruments = set()
    for setup in setups:
        if setup.get("instrument_id"):
            unique_instruments.add(setup["instrument_id"])
        for t in setup.get("instruments") or []:
            if t.get("instrument_id") is not None:
                unique_instruments.add(t["instrument_id"])

    return {
        "timestamp": datetime.utcnow().isoformat() + "Z",
        "active_monitoring_setups": active_count,
        "connected_instruments": len(unique_instruments),
        "setups": setups,
    }


@router.get("/live-data")
async def get_live_data(limit: int = Query(default=50, le=1000)) -> List[Dict[str, Any]]:
    """Get the latest readings from all monitoring setups."""
    collector = get_data_collector()
    return collector.get_latest_readings(limit=limit)


@router.get("/live-data/{setup_id}")
async def get_setup_live_data(
    setup_id: int, limit: int = Query(default=50, le=1000)
) -> List[Dict[str, Any]]:
    """Get the latest readings for a specific monitoring setup."""
    collector = get_data_collector()
    return collector.get_readings_for_setup(setup_id, limit=limit)


@router.get("/historical-data")
async def get_historical_data(
    hours: int = Query(default=24, ge=1, le=168)  # Max 1 week
) -> List[Dict[str, Any]]:
    """Get historical data for the specified number of hours."""
    collector = get_data_collector()
    end_time = datetime.utcnow()
    start_time = end_time - timedelta(hours=hours)
    return collector.get_readings_by_time_range(start_time, end_time)


@router.post("/monitoring/{setup_id}/start")
async def start_monitoring(setup_id: int) -> Dict[str, str]:
    """Start data collection for a monitoring setup."""
    storage = get_storage()
    setup = storage.get_monitoring_setup(setup_id)
    
    if not setup:
        raise HTTPException(status_code=404, detail="Monitoring setup not found")
    
    collector = get_data_collector()
    collector.start_monitoring(setup_id)
    
    return {"status": "started", "setup_id": str(setup_id)}


@router.post("/monitoring/{setup_id}/stop")
async def stop_monitoring(setup_id: int) -> Dict[str, str]:
    """Stop data collection for a monitoring setup."""
    collector = get_data_collector()
    collector.stop_monitoring(setup_id)
    # Attempt to run disable commands once on stop
    try:
        await collector.disable_mode_for_setup(setup_id)
    except Exception:
        pass
    
    return {"status": "stopped", "setup_id": str(setup_id)}


@router.post("/monitoring/{setup_id}/collect")
async def collect_now(setup_id: int) -> Dict[str, Any]:
    """Manually trigger a single data collection from a monitoring setup."""
    collector = get_data_collector()
    reading = await collector.collect_from_setup(setup_id)
    
    if reading is None:
        raise HTTPException(status_code=404, detail="Failed to collect data")
    
    return reading


@router.get("/monitoring/{setup_id}/status")
async def monitoring_status(setup_id: int) -> Dict[str, Any]:
    """Return status info for a monitoring setup (running, last success/error)."""
    collector = get_data_collector()
    return collector.get_status(setup_id)


@router.post("/monitoring/{setup_id}/reset")
async def reset_monitoring_data(setup_id: int) -> Dict[str, Any]:
    """Clear stored readings for a monitoring setup."""
    collector = get_data_collector()
    removed = collector.reset_readings_for_setup(setup_id)
    return {"status": "reset", "removed": removed, "setup_id": str(setup_id)}


@router.get("/monitoring/{setup_id}/export.csv")
async def export_monitoring_csv(setup_id: int) -> StreamingResponse:
    """Export readings for a monitoring setup as CSV.

    Format:
    - One row per reading timestamp
    - Columns for each signal across all instruments in the setup
    - Header includes unit in brackets for clarity
    - Missing values are left blank
    """
    storage = get_storage()
    setup = storage.get_monitoring_setup(setup_id)
    if not setup:
        raise HTTPException(status_code=404, detail="Monitoring setup not found")

    collector = get_data_collector()
    readings = collector.get_all_readings_for_setup(setup_id)
    # Sort by timestamp
    try:
        readings.sort(key=lambda r: r.get("timestamp") or "")
    except Exception:
        pass

    # Determine signal columns across all readings, qualified by instrument
    # Use (instrument_name, signal_name) to avoid collisions; capture unit from first occurrence
    column_defs: Dict[Tuple[str, str], str] = {}
    for r in readings:
        instr = (r.get("instrument_name") or f"#{r.get('instrument_id')}")
        rd = r.get("readings") or {}
        if isinstance(rd, dict):
            for sig_name, sig_obj in rd.items():
                unit = ""
                if isinstance(sig_obj, dict):
                    unit = str(sig_obj.get("unit") or "")
                col_label = f"{instr}.{sig_name}"
                if unit:
                    col_label = f"{col_label} [{unit}]"
                column_defs.setdefault((instr, str(sig_name)), col_label)

    # Stable order: sort by instrument then signal label
    ordered_cols = sorted(column_defs.items(), key=lambda kv: (kv[0][0], kv[0][1]))

    # Time bucketing: use half the monitoring interval
    frequency_hz = float(setup.get("frequency_hz") or 0.0)
    bucket_seconds = 0.5 / frequency_hz if frequency_hz > 0 else 1.0

    def to_epoch(ts: str) -> float:
        try:
            dt = datetime.fromisoformat(ts.replace("Z", "+00:00"))
            return dt.timestamp()
        except Exception:
            return 0.0

    # Group readings by bucket index
    # bucket_index = floor(epoch / bucket_seconds)
    buckets: DefaultDict[int, Dict[Tuple[str, str], Any]] = defaultdict(dict)
    bucket_ts: DefaultDict[int, float] = defaultdict(float)  # representative timestamp per bucket (start)
    for r in readings:
        ts = r.get("timestamp")
        if not ts:
            continue
        epoch = to_epoch(ts)
        if bucket_seconds <= 0:
            bidx = int(epoch)
        else:
            bidx = int(epoch // bucket_seconds)
        if bidx not in bucket_ts:
            # store bucket start time
            bucket_ts[bidx] = (bidx * bucket_seconds)
        instr = (r.get("instrument_name") or f"#{r.get('instrument_id')}")
        rd = r.get("readings") or {}
        if isinstance(rd, dict):
            for sig_name, sig_obj in rd.items():
                val = None
                if isinstance(sig_obj, dict):
                    val = sig_obj.get("value")
                elif isinstance(sig_obj, (int, float)):
                    val = sig_obj
                # Use latest value wins within the bucket
                buckets[bidx][(instr, str(sig_name))] = val

    def generate_csv() -> io.StringIO:
        output = io.StringIO()
        writer = csv.writer(output)
        # Header
        header = ["timestamp"] + [label for (_, label) in ordered_cols]
        writer.writerow(header)
        # Rows: iterate buckets in chronological order
        for bidx in sorted(buckets.keys()):
            # bucket start ISO timestamp
            bstart_epoch = bucket_ts.get(bidx, bidx * bucket_seconds)
            ts_iso = datetime.utcfromtimestamp(bstart_epoch).isoformat() + "Z"
            row: List[Any] = [ts_iso]
            values = buckets[bidx]
            for (col_key, _label) in ordered_cols:
                row.append(values.get(col_key, ""))
            writer.writerow(row)
        output.seek(0)
        return output

    csv_io = generate_csv()
    filename = f"monitoring_{setup_id}_{(setup.get('name') or 'setup').replace(' ', '_')}.csv"
    return StreamingResponse(
        csv_io, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=\"{filename}\""}
    )
