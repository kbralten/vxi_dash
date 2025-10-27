"""File-based storage for instruments and monitoring configurations."""
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

from app.core.config import get_settings

settings = get_settings()


class FileStorage:
    """Manage JSON file storage for configurations."""

    def __init__(self, data_dir: str = "data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        self.instruments_file = self.data_dir / "instruments.json"
        self.monitoring_file = self.data_dir / "monitoring.json"
        self._ensure_files_exist()

    def _ensure_files_exist(self) -> None:
        """Create empty JSON files if they don't exist."""
        if not self.instruments_file.exists():
            self.instruments_file.write_text("[]")
        if not self.monitoring_file.exists():
            self.monitoring_file.write_text("[]")

    def _load_json(self, file_path: Path) -> List[Dict[str, Any]]:
        """Load JSON from file."""
        try:
            return json.loads(file_path.read_text())
        except (json.JSONDecodeError, FileNotFoundError):
            return []

    def _save_json(self, file_path: Path, data: List[Dict[str, Any]]) -> None:
        """Save JSON to file with pretty formatting."""
        file_path.write_text(json.dumps(data, indent=2))

    # Instruments
    def get_instruments(self) -> List[Dict[str, Any]]:
        """Get all instruments."""
        return self._load_json(self.instruments_file)

    def get_instrument(self, instrument_id: int) -> Optional[Dict[str, Any]]:
        """Get instrument by ID."""
        instruments = self.get_instruments()
        for instrument in instruments:
            if instrument.get("id") == instrument_id:
                return instrument
        return None

    def create_instrument(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new instrument."""
        instruments = self.get_instruments()
        # Generate new ID
        new_id = max([inst.get("id", 0) for inst in instruments], default=0) + 1
        data["id"] = new_id
        instruments.append(data)
        self._save_json(self.instruments_file, instruments)
        return data

    def update_instrument(self, instrument_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update existing instrument."""
        instruments = self.get_instruments()
        for i, instrument in enumerate(instruments):
            if instrument.get("id") == instrument_id:
                instruments[i] = {**instrument, **data, "id": instrument_id}
                self._save_json(self.instruments_file, instruments)
                return instruments[i]
        return None

    def delete_instrument(self, instrument_id: int) -> bool:
        """Delete instrument by ID."""
        instruments = self.get_instruments()
        original_length = len(instruments)
        instruments = [inst for inst in instruments if inst.get("id") != instrument_id]
        if len(instruments) < original_length:
            self._save_json(self.instruments_file, instruments)
            return True
        return False

    # Monitoring Setups
    def get_monitoring_setups(self) -> List[Dict[str, Any]]:
        """Get all monitoring setups."""
        return self._load_json(self.monitoring_file)

    def get_monitoring_setup(self, setup_id: int) -> Optional[Dict[str, Any]]:
        """Get monitoring setup by ID."""
        setups = self.get_monitoring_setups()
        for setup in setups:
            if setup.get("id") == setup_id:
                return setup
        return None

    def create_monitoring_setup(self, data: Dict[str, Any]) -> Dict[str, Any]:
        """Create new monitoring setup."""
        setups = self.get_monitoring_setups()
        # Generate new ID
        new_id = max([setup.get("id", 0) for setup in setups], default=0) + 1
        data["id"] = new_id
        setups.append(data)
        self._save_json(self.monitoring_file, setups)
        return data

    def update_monitoring_setup(self, setup_id: int, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Update existing monitoring setup."""
        setups = self.get_monitoring_setups()
        for i, setup in enumerate(setups):
            if setup.get("id") == setup_id:
                setups[i] = {**setup, **data, "id": setup_id}
                self._save_json(self.monitoring_file, setups)
                return setups[i]
        return None

    def delete_monitoring_setup(self, setup_id: int) -> bool:
        """Delete monitoring setup by ID."""
        setups = self.get_monitoring_setups()
        original_length = len(setups)
        setups = [setup for setup in setups if setup.get("id") != setup_id]
        if len(setups) < original_length:
            self._save_json(self.monitoring_file, setups)
            return True
        return False


# Singleton instance
_storage: Optional[FileStorage] = None


def get_storage() -> FileStorage:
    """Get file storage instance."""
    global _storage
    if _storage is None:
        _storage = FileStorage()
    return _storage
