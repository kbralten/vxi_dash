from __future__ import annotations

from typing import TYPE_CHECKING, Optional

from pydantic import ConfigDict
from sqlalchemy.orm import relationship
from sqlmodel import Field, Relationship, SQLModel

if TYPE_CHECKING:  # pragma: no cover - import for type hints only
    from app.models.monitoring import MonitoringSetup


class InstrumentBase(SQLModel):
    name: str = Field(max_length=100)
    address: str = Field(max_length=255, description="IP address or hostname")
    description: Optional[str] = Field(default=None, max_length=10000)
    is_active: bool = Field(default=True)


class Instrument(InstrumentBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    monitoring_setups: list["MonitoringSetup"] = Relationship(
        sa_relationship=relationship(
            "MonitoringSetup",
            back_populates="instrument",
        )
    )


class InstrumentCreate(InstrumentBase):
    pass


class InstrumentRead(InstrumentBase):
    id: int
    model_config = ConfigDict(from_attributes=True)


class InstrumentUpdate(SQLModel):
    name: Optional[str] = None
    address: Optional[str] = None
    description: Optional[str] = None
    is_active: Optional[bool] = None
