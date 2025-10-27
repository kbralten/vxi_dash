import { apiClient } from './apiClient';
import type { Instrument, InstrumentBase } from '../types/instrument';

export async function fetchInstruments(): Promise<Instrument[]> {
  const response = await apiClient.get<Instrument[]>('/instruments/');
  return response.data;
}

export async function createInstrument(data: InstrumentBase): Promise<Instrument> {
  const response = await apiClient.post<Instrument>('/instruments/', data);
  return response.data;
}

export async function updateInstrument(id: number, data: Partial<InstrumentBase>): Promise<Instrument> {
  const response = await apiClient.put<Instrument>(`/instruments/${id}`, data);
  return response.data;
}

export async function deleteInstrument(id: number): Promise<void> {
  await apiClient.delete(`/instruments/${id}`);
}

export async function getInstruments(): Promise<Instrument[]> {
  return fetchInstruments();
}

export async function sendCommand(instrumentId: number, command: string): Promise<{ response: string }> {
  const response = await apiClient.post<{ response: string }>(`/instruments/${instrumentId}/command`, {
    command,
  });
  return response.data;
}
