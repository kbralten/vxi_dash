import { apiClient } from './apiClient';
import type { DashboardSummary } from '../types/dashboard';

export async function fetchDashboardSummary(): Promise<DashboardSummary> {
  const response = await apiClient.get<DashboardSummary>('/dashboard/summary');
  return response.data;
}
