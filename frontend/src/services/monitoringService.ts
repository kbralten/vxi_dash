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

export async function exportMonitoringCsv(id: number): Promise<Blob> {
  const response = await apiClient.get(`/dashboard/monitoring/${id}/export.csv`, { responseType: 'blob' });
  return response.data as Blob;
}

// State machine control endpoints
export interface StateMachineStatus {
  setup_id: number;
  is_running: boolean;
  current_state_id: string | null;
  session_started_at: string | null;
  state_entered_at: string | null;
  time_in_current_state: number | null;
  total_session_time: number | null;
}

export async function startStateMachine(setupId: number): Promise<{ message: string; status: StateMachineStatus }> {
  const response = await apiClient.post<{ message: string; status: StateMachineStatus }>(`/state-machine/${setupId}/start`, {});
  return response.data;
}

export async function stopStateMachine(setupId: number): Promise<{ message: string; setup_id: number }> {
  const response = await apiClient.post<{ message: string; setup_id: number }>(`/state-machine/${setupId}/stop`, {});
  return response.data;
}

export async function getStateMachineStatus(setupId: number): Promise<StateMachineStatus> {
  const response = await apiClient.get<StateMachineStatus>(`/state-machine/${setupId}/status`);
  return response.data;
}

export async function getAllStateMachineSessions(): Promise<StateMachineStatus[]> {
  const response = await apiClient.get<StateMachineStatus[]>('/state-machine/');
  return response.data;
}
