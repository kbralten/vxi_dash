import { apiClient } from './apiClient';

export interface Reading {
  timestamp: string;
  setup_id: number;
  setup_name: string;
  instrument_id: number;
  instrument_name: string;
  // Backend now returns full mode objects; accept either string or object
  mode: string | { name?: string; [key: string]: any };
  readings: {
    [signalName: string]: {
      value: number | null;
      raw_value?: number;
      unit: string;
      raw_response?: string;
      error?: string;
    };
  };
  error?: string;
}

export async function fetchLiveData(limit: number = 50): Promise<Reading[]> {
  const response = await apiClient.get<Reading[]>(`/dashboard/live-data?limit=${limit}`);
  return response.data;
}

export async function fetchSetupLiveData(setupId: number, limit: number = 50): Promise<Reading[]> {
  const response = await apiClient.get<Reading[]>(`/dashboard/live-data/${setupId}?limit=${limit}`);
  return response.data;
}

export async function fetchHistoricalData(hours: number = 24): Promise<Reading[]> {
  const response = await apiClient.get<Reading[]>(`/dashboard/historical-data?hours=${hours}`);
  return response.data;
}

export async function startMonitoring(setupId: number): Promise<{ status: string }> {
  const response = await apiClient.post<{ status: string }>(`/dashboard/monitoring/${setupId}/start`);
  return response.data;
}

export async function stopMonitoring(setupId: number): Promise<{ status: string }> {
  const response = await apiClient.post<{ status: string }>(`/dashboard/monitoring/${setupId}/stop`);
  return response.data;
}

export async function collectNow(setupId: number): Promise<Reading> {
  const response = await apiClient.post<Reading>(`/dashboard/monitoring/${setupId}/collect`);
  return response.data;
}
