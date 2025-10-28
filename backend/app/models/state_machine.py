"""State machine data structures and normalization utilities.

These types describe the shape of the state machine stored with a MonitoringSetup.
We keep validation light to avoid breaking existing payloads; shapes are normalized
on create/update and when listing/getting setups.
"""
from __future__ import annotations

from typing import Any, Dict, List, Literal, Optional, TypedDict


RuleType = Literal["sensor", "timeInState", "totalTime"]
Comparator = Literal[">", "<", ">=", "<=", "==", "!="]


class Rule(TypedDict, total=False):
    type: RuleType
    # sensor rule
    signalName: str
    operator: Comparator
    value: float
    # time rules (seconds)
    seconds: float


class InstrumentSetting(TypedDict, total=False):
    # Choose either modeId or modeName; modeParams optional
    modeId: Optional[str]
    modeName: Optional[str]
    modeParams: Dict[str, Any]


class State(TypedDict, total=False):
    id: str
    name: str
    isEndState: bool
    # map instrument_id (as string) to settings
    instrumentSettings: Dict[str, InstrumentSetting]


class Transition(TypedDict, total=False):
    id: str
    sourceStateID: str
    targetStateID: str
    rules: List[Rule]


class StateMachine(TypedDict, total=False):
    states: List[State]
    transitions: List[Transition]
    initialStateID: Optional[str]


def _ensure_list(val: Any) -> List[Any]:
    return val if isinstance(val, list) else []


def normalize_state_machine_fields(setup: Dict[str, Any]) -> Dict[str, Any]:
    """Ensure a MonitoringSetup dict has state machine fields in a consistent shape.

    - Accept either top-level `states`/`transitions` or a nested `stateMachine` object
    - If absent, add empty lists for `states` and `transitions`
    - Do not throw on minor schema differences; keep best-effort normalization
    """
    if not isinstance(setup, dict):
        return setup

    # If nested object provided, expand to top-level
    sm = setup.get("stateMachine")
    if isinstance(sm, dict):
        if "states" not in setup and isinstance(sm.get("states"), list):
            setup["states"] = sm.get("states")
        if "transitions" not in setup and isinstance(sm.get("transitions"), list):
            setup["transitions"] = sm.get("transitions")
        if "initialStateID" not in setup and (sm.get("initialStateID") is not None):
            setup["initialStateID"] = sm.get("initialStateID")

    # Ensure lists exist
    setup["states"] = _ensure_list(setup.get("states"))
    setup["transitions"] = _ensure_list(setup.get("transitions"))

    # Light normalization for entries
    def _norm_state(s: Any) -> Any:
        if not isinstance(s, dict):
            return s
        # Remove deprecated isInitialState field
        s.pop("isInitialState", None)
        # instrumentSettings should be a dict
        if not isinstance(s.get("instrumentSettings"), dict):
            s["instrumentSettings"] = {}
        return s

    def _norm_transition(t: Any) -> Any:
        if not isinstance(t, dict):
            return t
        # rules should be a list
        if not isinstance(t.get("rules"), list):
            t["rules"] = []
        return t

    setup["states"] = [_norm_state(s) for s in setup["states"]]
    setup["transitions"] = [_norm_transition(t) for t in setup["transitions"]]

    return setup


def validate_state_machine_on_write(payload: Dict[str, Any]) -> None:
    """Very light validation for create/update requests.

    - If `states` present, must be a list
    - If `transitions` present, must be a list
    - If `stateMachine` present, must be an object
    """
    if "states" in payload and not isinstance(payload.get("states"), list):
        raise ValueError("states must be a list")
    if "transitions" in payload and not isinstance(payload.get("transitions"), list):
        raise ValueError("transitions must be a list")
    if "stateMachine" in payload and not isinstance(payload.get("stateMachine"), dict):
        raise ValueError("stateMachine must be an object")
