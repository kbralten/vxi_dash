import { apiClient } from './apiClient';
import type { MonitoringCreate, MonitoringSetup } from '../types/monitoring';

export async function fetchMonitoringSetups(): Promise<MonitoringSetup[]> {
  const response = await apiClient.get<MonitoringSetup[]>('/monitoring/');
  return response.data;
}

export async function createMonitoringSetup(payload: MonitoringCreate): Promise<MonitoringSetup> {
  const response = await apiClient.post<MonitoringSetup>('/monitoring/', payload);
  return response.data;
}

export async function updateMonitoringSetup(id: number, payload: Partial<MonitoringCreate>): Promise<MonitoringSetup> {
  const response = await apiClient.put<MonitoringSetup>(`/monitoring/${id}`, payload);
  return response.data;
}

export async function deleteMonitoringSetup(id: number): Promise<void> {
  await apiClient.delete(`/monitoring/${id}`);
}

// Controls and status live under the dashboard router
export async function startMonitoringSetup(id: number): Promise<{ status: string; setup_id: string }>{
  const response = await apiClient.post<{ status: string; setup_id: string }>(`/dashboard/monitoring/${id}/start`, {});
  return response.data;
}

export async function stopMonitoringSetup(id: number): Promise<{ status: string; setup_id: string }>{
  const response = await apiClient.post<{ status: string; setup_id: string }>(`/dashboard/monitoring/${id}/stop`, {});
  return response.data;
}

export interface MonitoringStatusResponse {
  running: boolean;
  last_success?: string | null;
  last_error?: string | null;
  timestamp?: string;
}

export async function getMonitoringStatus(id: number): Promise<MonitoringStatusResponse> {
  const response = await apiClient.get<MonitoringStatusResponse>(`/dashboard/monitoring/${id}/status`);
  return response.data;
}

export async function resetMonitoringReadings(id: number): Promise<{ status: string; removed: number; setup_id: string }>{
  const response = await apiClient.post<{ status: string; removed: number; setup_id: string }>(`/dashboard/monitoring/${id}/reset`, {});
  return response.data;
}
