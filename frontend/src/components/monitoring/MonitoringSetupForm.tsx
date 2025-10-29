import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { fetchInstruments } from '../../services/instrumentService';
import { createMonitoringSetup } from '../../services/monitoringService';
import type { Instrument } from '../../types/instrument';
import type { MonitoringCreate, State, Transition } from '../../types/monitoring';
import type { InstrumentConfiguration, Mode } from '../../types/instrumentConfig';
import { StateMachineEditor } from './StateMachineEditor';

type FormState = {
  name: string;
  frequency_seconds: number;
  useStateMachine: boolean;
};

const createDefaultForm = (): FormState => ({
  name: '',
  frequency_seconds: 1,
  useStateMachine: false,
});

type TargetRow = {
  instrument_id: number;
  config: InstrumentConfiguration | null;
  selectedModeId: string;
  modeParams: Record<string, string>;
};

export function MonitoringSetupForm(): ReactElement {
  const [form, setForm] = useState<FormState>(() => createDefaultForm());
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [status, setStatus] = useState<string>('');
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [states, setStates] = useState<State[]>([]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [initialStateID, setInitialStateID] = useState<string | undefined>();

  useEffect(() => {
    fetchInstruments().then(setInstruments).catch((err: Error) => setStatus(err.message));
  }, []);

  // Helpers to manage a target row
  const buildTarget = (instrument_id: number): TargetRow => {
    const inst = instruments.find((i) => i.id === instrument_id);
    let config: InstrumentConfiguration | null = null;
    let selectedModeId = '';
    let modeParams: Record<string, string> = {};
    try {
      config = inst?.description ? (JSON.parse(inst.description) as InstrumentConfiguration) : null;
      const firstMode = config?.modes?.[0];
      if (firstMode) {
        selectedModeId = firstMode.id;
        for (const p of firstMode.parameters || []) modeParams[p.name] = '';
      }
    } catch (e) {
      console.error('Failed to parse instrument description JSON', e);
      config = null;
    }
    return { instrument_id, config, selectedModeId, modeParams };
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      const seconds = form.frequency_seconds;
      const freqHz = seconds > 0 ? 1 / seconds : 0;
      const payload: MonitoringCreate = {
        name: form.name,
        frequency_hz: freqHz,
        instruments: targets.map((t) => {
          const mode: Mode | undefined = t.config?.modes?.find((m) => m.id === t.selectedModeId);
          return {
            instrument_id: t.instrument_id,
            parameters: {
              ...(mode?.id ? { modeId: mode.id } : {}),
              ...(mode?.name ? { modeName: mode.name } : {}),
              ...(Object.keys(t.modeParams).length ? { modeParams: t.modeParams } : {}),
            },
          };
        }),
      };

      // Add state machine configuration if enabled
      if (form.useStateMachine) {
        payload.states = states;
        payload.initialStateID = initialStateID;
        payload.transitions = transitions;
      }

      await createMonitoringSetup(payload);
      setStatus('Created monitoring setup');
      setForm(createDefaultForm());
      // Notify other components (e.g., list) to refresh
      window.dispatchEvent(new CustomEvent('monitoring:refresh'));
      setTargets([]);
      setStates([]);
      setTransitions([]);
      setInitialStateID(undefined);
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
        <label className="block text-sm text-slate-300" htmlFor="monitoring-interval">
          Collection interval (seconds)
        </label>
        <input
          id="monitoring-interval"
          type="number"
          min="0.1"
          step="0.1"
          value={form.frequency_seconds}
          onChange={(event) => setForm({ ...form, frequency_seconds: Number(event.target.value) })}
          className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
        />
        <p className="mt-1 text-xs text-slate-500">Enter the desired collection interval in seconds (e.g., 1 = once per second).</p>
      </div>

      <div className="rounded border border-slate-700 bg-slate-800/30 p-3">
        <label className="flex items-center gap-2">
          <input
            type="checkbox"
            checked={form.useStateMachine}
            onChange={(e) => setForm({ ...form, useStateMachine: e.target.checked })}
            className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-primary-light focus:ring-2 focus:ring-primary-light"
          />
          <span className="text-sm font-medium text-slate-200">
            Enable State Machine (Advanced Workflows)
          </span>
        </label>
        <p className="mt-1 ml-6 text-xs text-slate-400">
          Create automated workflows with multiple states and conditional transitions.
        </p>
      </div>

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-200">Instruments</h3>
          <button
            type="button"
            onClick={() => setTargets((prev) => [...prev, buildTarget(0)])}
            className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200 hover:bg-slate-600"
          >
            Add Instrument
          </button>
        </div>

        {targets.length === 0 && (
          <p className="text-xs text-slate-400">No instruments added yet. Click "Add Instrument" to begin.</p>
        )}

        {targets.map((t, idx) => {
          const selectedMode: Mode | undefined = t.config?.modes?.find((m) => m.id === t.selectedModeId);
          return (
            <div key={idx} className="rounded border border-slate-800 bg-slate-900/40 p-3">
              <div className="flex items-center justify-between">
                <div className="text-xs font-medium text-slate-300">Target {idx + 1}</div>
                <button
                  type="button"
                  onClick={() => setTargets((prev) => prev.filter((_, i) => i !== idx))}
                  className="rounded bg-red-900/40 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-900/60"
                >
                  Remove
                </button>
              </div>
              <div className="mt-2 grid gap-3 md:grid-cols-2">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Instrument</label>
                  <select
                    value={t.instrument_id}
                    onChange={(e) => {
                      const instrument_id = Number(e.target.value);
                      setTargets((prev) => {
                        const next = [...prev];
                        next[idx] = buildTarget(instrument_id);
                        return next;
                      });
                    }}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                  >
                    <option value={0}>Select instrument</option>
                    {instruments.map((instrument) => (
                      <option key={instrument.id} value={instrument.id}>
                        {instrument.name}
                      </option>
                    ))}
                  </select>
                </div>
                {t.config?.modes && t.config.modes.length > 0 && (
                  <div>
                    <label className="block text-xs text-slate-400 mb-1">Mode</label>
                    <select
                      value={t.selectedModeId}
                      onChange={(e) => {
                        const newId = e.target.value;
                        setTargets((prev) => {
                          const next = [...prev];
                          const nt = { ...next[idx] };
                          nt.selectedModeId = newId;
                          const m = nt.config?.modes?.find((mm) => mm.id === newId);
                          const defaults: Record<string, string> = {};
                          if (m) for (const p of m.parameters || []) defaults[p.name] = '';
                          nt.modeParams = defaults;
                          next[idx] = nt;
                          return next;
                        });
                      }}
                      className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm"
                    >
                      {t.config.modes.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>

              {selectedMode && selectedMode.parameters && selectedMode.parameters.length > 0 && (
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {selectedMode.parameters.map((p) => (
                    <div key={p.name}>
                      <label className="block text-xs text-slate-400 mb-1">{p.name}</label>
                      <input
                        type="text"
                        value={t.modeParams[p.name] ?? ''}
                        onChange={(e) =>
                          setTargets((prev) => {
                            const next = [...prev];
                            const nt = { ...next[idx] };
                            nt.modeParams = { ...nt.modeParams, [p.name]: e.target.value };
                            next[idx] = nt;
                            return next;
                          })
                        }
                        className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {form.useStateMachine && (
        <StateMachineEditor
          states={states}
          transitions={transitions}
          initialStateID={initialStateID}
          instruments={instruments.filter((inst) => targets.some((t) => t.instrument_id === inst.id))}
          onChange={(newStates, newInitialStateID) => {
            setStates(newStates);
            setInitialStateID(newInitialStateID);
          }}
          onTransitionsChange={(newTransitions) => {
            setTransitions(newTransitions);
          }}
        />
      )}

      <button
        type="submit"
        className="w-full rounded bg-primary-light px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-primary"
        disabled={
          !form.name ||
          targets.length === 0 ||
          targets.some((t) => t.instrument_id === 0) ||
          targets.some((t) => {
            const mode = t.config?.modes?.find((m) => m.id === t.selectedModeId);
            return !!(mode && mode.parameters?.some((p) => (t.modeParams[p.name] ?? '').trim() === ''));
          }) ||
          (form.useStateMachine && states.length === 0) ||
          (form.useStateMachine && !initialStateID)
        }
      >
        Create Setup
      </button>

      {status && <p className="text-xs text-slate-400">{status}</p>}
    </form>
  );
}
