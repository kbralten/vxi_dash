from __future__ import annotations

from typing import Any, Dict, Optional

from pydantic import ConfigDict
from sqlalchemy import Column, JSON
from sqlalchemy.orm import relationship
from sqlmodel import Field, Relationship, SQLModel

from app.models.instrument import Instrument, InstrumentRead


class MonitoringBase(SQLModel):
    name: str = Field(max_length=100)
    frequency_hz: float = Field(gt=0)
    instrument_id: int = Field(foreign_key="instrument.id")
    parameters: Dict[str, Any] = Field(
        default_factory=dict,
        sa_column=Column(JSON, nullable=False),
        description="Parameter values supplied when enabling instrument modes",
    )


class MonitoringSetup(MonitoringBase, table=True):
    id: Optional[int] = Field(default=None, primary_key=True)
    instrument: Optional[Instrument] = Relationship(
        sa_relationship=relationship(
            "Instrument",
            back_populates="monitoring_setups",
        )
    )


class MonitoringCreate(MonitoringBase):
    pass


class MonitoringRead(MonitoringBase):
    id: int
    instrument: Optional[InstrumentRead] = None
    model_config = ConfigDict(from_attributes=True)


class MonitoringUpdate(SQLModel):
    name: Optional[str] = None
    frequency_hz: Optional[float] = None
    parameters: Optional[Dict[str, Any]] = None
