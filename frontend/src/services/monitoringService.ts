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
