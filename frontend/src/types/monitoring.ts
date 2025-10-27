import type { Instrument } from './instrument';

export interface MonitoringBase {
  name: string;
  frequency_hz: number;
  instrument_id: number;
  parameters: Record<string, unknown>;
}

export interface MonitoringSetup extends MonitoringBase {
  id: number;
  instrument?: Instrument | null;
}

export type MonitoringCreate = MonitoringBase;

export type MonitoringUpdate = Partial<MonitoringBase>;
