import type { Instrument } from './instrument';

export interface MonitoringTargetBase {
  instrument_id: number;
  parameters: Record<string, unknown>;
}

export interface MonitoringTarget extends MonitoringTargetBase {
  instrument?: Instrument | null;
}

export interface MonitoringBase {
  name: string;
  frequency_hz: number;
  // New multi-instrument shape
  instruments?: MonitoringTargetBase[];
  // Backward-compatible single-instrument fields (may be omitted)
  instrument_id?: number;
  parameters?: Record<string, unknown>;
}

export interface MonitoringSetup extends MonitoringBase {
  id: number;
  // Enriched fields
  instruments?: MonitoringTarget[];
  instrument?: Instrument | null;
}

export type MonitoringCreate = MonitoringBase;

export type MonitoringUpdate = Partial<MonitoringBase>;
