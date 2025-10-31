import { FormEvent, useEffect, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import { fetchInstruments } from '../../services/instrumentService';
import { createMonitoringSetup } from '../../services/monitoringService';
import type { Instrument } from '../../types/instrument';
import type { MonitoringCreate, State, Transition } from '../../types/monitoring';
import { StateMachineEditor } from './StateMachineEditor';
import { validateStateMachine, formatValidationMessage } from '../../utils/stateMachineValidation';

type FormState = {
  name: string;
  frequency_seconds: number;
};

const createDefaultForm = (): FormState => ({
  name: '',
  frequency_seconds: 1,
});

export function MonitoringSetupForm(): ReactElement {
  const [form, setForm] = useState<FormState>(() => createDefaultForm());
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [status, setStatus] = useState<string>('');
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState<number[]>([]);
  
  // Initialize with one default "Initial State"
  const [states, setStates] = useState<State[]>([{
    id: 'state_1',
    name: 'Initial State',
    isEndState: false,
    instrumentSettings: {},
  }]);
  const [transitions, setTransitions] = useState<Transition[]>([]);
  const [initialStateID, setInitialStateID] = useState<string | undefined>('state_1');

  useEffect(() => {
    fetchInstruments().then(setInstruments).catch((err: Error) => setStatus(err.message));
  }, []);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    try {
      // Validate state machine (always required now)
      const validation = validateStateMachine(states, transitions, initialStateID);
      
      if (!validation.valid) {
        const message = formatValidationMessage(validation);
        setStatus(`State machine validation failed:\n\n${message}`);
        return;
      }

      // Warnings are informational only - no need to prompt

      const seconds = form.frequency_seconds;
      const freqHz = seconds > 0 ? 1 / seconds : 0;
      const payload: MonitoringCreate = {
        name: form.name,
        frequency_hz: freqHz,
        instruments: selectedInstrumentIds.map((instrument_id) => ({
          instrument_id,
          parameters: {}, // Parameters are now defined in states
        })),
      };

      // Add state machine configuration (always included)
      payload.states = states;
      payload.initialStateID = initialStateID;
      payload.transitions = transitions;

      await createMonitoringSetup(payload);
      setStatus('Created monitoring setup');
      setForm(createDefaultForm());
      // Notify other components (e.g., list) to refresh
      window.dispatchEvent(new CustomEvent('monitoring:refresh'));
      setSelectedInstrumentIds([]);
      // Reset to default initial state
      setStates([{
        id: 'state_1',
        name: 'Initial State',
        isEndState: false,
        instrumentSettings: {},
      }]);
      setTransitions([]);
      setInitialStateID('state_1');
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

      <div className="space-y-4">
        <div>
          <label className="block text-sm font-semibold text-slate-200 mb-2">Instruments</label>
          <p className="text-xs text-slate-400 mb-3">
            Select the instruments that will be used in this monitoring setup. 
            Modes and parameters are configured per-state in the state machine below.
          </p>
          <div className="space-y-2">
            {instruments.map((instrument) => (
              <label key={instrument.id} className="flex items-center gap-2 p-2 rounded border border-slate-700 bg-slate-800/30 hover:bg-slate-800/50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selectedInstrumentIds.includes(instrument.id)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setSelectedInstrumentIds([...selectedInstrumentIds, instrument.id]);
                    } else {
                      setSelectedInstrumentIds(selectedInstrumentIds.filter(id => id !== instrument.id));
                    }
                  }}
                  className="h-4 w-4 rounded border-slate-600 bg-slate-700 text-primary-light focus:ring-2 focus:ring-primary-light"
                />
                <span className="text-sm text-slate-200">{instrument.name}</span>
                <span className="text-xs text-slate-400 ml-auto">{instrument.address}</span>
              </label>
            ))}
            {instruments.length === 0 && (
              <p className="text-xs text-slate-400 italic">No instruments available. Add instruments first.</p>
            )}
          </div>
        </div>
      </div>

      <StateMachineEditor
        states={states}
        transitions={transitions}
        initialStateID={initialStateID}
        instruments={instruments.filter((inst) => selectedInstrumentIds.includes(inst.id))}
        onChange={(newStates, newInitialStateID) => {
          setStates(newStates);
          setInitialStateID(newInitialStateID);
        }}
        onTransitionsChange={(newTransitions) => {
          setTransitions(newTransitions);
        }}
      />      <button
        type="submit"
        className="w-full rounded bg-primary-light px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-primary"
        disabled={
          !form.name ||
          selectedInstrumentIds.length === 0 ||
          states.length === 0 ||
          !initialStateID
        }
      >
        Create Setup
      </button>

      {status && <p className="text-xs text-slate-400">{status}</p>}
    </form>
  );
}
