export interface DashboardSummary {
  timestamp: string;
  active_monitoring_setups: number;
  connected_instruments: number;
  setups: Array<{
    id: number;
    name: string;
    frequency_hz: number;
    instrument_id: number;
    instrument: {
      id: number | null;
      name: string | null;
    } | null;
  }>;
}
