import { FormEvent, useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { fetchInstruments } from '../../services/instrumentService';
import { createMonitoringSetup } from '../../services/monitoringService';
import type { Instrument } from '../../types/instrument';
import type { MonitoringCreate } from '../../types/monitoring';

const createDefaultForm = (): MonitoringCreate => ({
  name: '',
  frequency_hz: 1,
  instrument_id: 0,
  parameters: {}
});

export function MonitoringSetupForm(): ReactElement {
  const [form, setForm] = useState<MonitoringCreate>(() => createDefaultForm());
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [status, setStatus] = useState<string>('');

  useEffect(() => {
    fetchInstruments().then(setInstruments).catch((err: Error) => setStatus(err.message));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      await createMonitoringSetup(form);
      setStatus('Created monitoring setup');
      setForm(createDefaultForm());
    } catch (error) {
      setStatus(error instanceof Error ? error.message : 'Failed to create setup');
    }
  };

  return (
    <form className="space-y-4 rounded border border-slate-800 bg-slate-900 p-4" onSubmit={handleSubmit}>
      <h2 className="text-lg font-semibold text-primary-light">New Monitoring Setup</h2>

      <div>
        <label className="block text-sm text-slate-300" htmlFor="monitoring-name">
          Name
        </label>
        <input
          id="monitoring-name"
          name="name"
          value={form.name}
          onChange={(event) => setForm({ ...form, name: event.target.value })}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
          required
        />
      </div>

      <div>
        <label className="block text-sm text-slate-300" htmlFor="monitoring-frequency">
          Frequency (Hz)
        </label>
        <input
          id="monitoring-frequency"
          type="number"
          min="0.1"
          step="0.1"
          value={form.frequency_hz}
          onChange={(event) => setForm({ ...form, frequency_hz: Number(event.target.value) })}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
        />
      </div>

      <div>
        <label className="block text-sm text-slate-300" htmlFor="monitoring-instrument">
          Instrument
        </label>
        <select
          id="monitoring-instrument"
          value={form.instrument_id}
          onChange={(event) => setForm({ ...form, instrument_id: Number(event.target.value) })}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
        >
          <option value={0}>Select instrument</option>
          {instruments.map((instrument) => (
            <option key={instrument.id} value={instrument.id}>
              {instrument.name}
            </option>
          ))}
        </select>
      </div>

      <button
        type="submit"
        className="w-full rounded bg-primary-light px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-primary"
        disabled={!form.name || !form.instrument_id}
      >
        Create Setup
      </button>

      {status && <p className="text-xs text-slate-400">{status}</p>}
    </form>
  );
}
