import type { Instrument } from './instrument';

export interface MonitoringTargetBase {
  instrument_id: number;
  parameters: Record<string, unknown>;
}

export interface MonitoringTarget extends MonitoringTargetBase {
  instrument?: Instrument | null;
}

// State Machine Types
export interface StateInstrumentSettings {
  [instrumentId: string]: {
    modeId: string;
    modeParams: Record<string, unknown>;
  };
}

export interface State {
  id: string;
  name: string;
  isEndState: boolean;
  instrumentSettings: StateInstrumentSettings;
}

export interface Rule {
  type: 'sensor' | 'timeInState' | 'totalTime';
  // For sensor rules
  signalName?: string;
  operator?: '>' | '>=' | '<' | '<=' | '==' | '!=';
  value?: number;
  // For time rules
  seconds?: number;
}

export interface Transition {
  id: string;
  sourceStateID: string;
  targetStateID: string;
  rules: Rule[];
}

export interface MonitoringBase {
  name: string;
  frequency_hz: number;
  // New multi-instrument shape
  instruments?: MonitoringTargetBase[];
  // Backward-compatible single-instrument fields (may be omitted)
  instrument_id?: number;
  parameters?: Record<string, unknown>;
  // State machine fields
  initialStateID?: string;
  states?: State[];
  transitions?: Transition[];
}

export interface MonitoringSetup extends MonitoringBase {
  id: number;
  // Enriched fields
  instruments?: MonitoringTarget[];
  instrument?: Instrument | null;
}

export type MonitoringCreate = MonitoringBase;

export type MonitoringUpdate = Partial<MonitoringBase>;
