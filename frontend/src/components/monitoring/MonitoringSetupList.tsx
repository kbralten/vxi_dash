import { useEffect, useRef, useState } from 'react';
import type { ReactElement } from 'react';
import {
  fetchMonitoringSetups,
  deleteMonitoringSetup,
  updateMonitoringSetup,
  startMonitoringSetup,
  stopMonitoringSetup,
  getMonitoringStatus,
  resetMonitoringReadings,
  startStateMachine,
  stopStateMachine,
  getStateMachineStatus,
  type StateMachineStatus,
} from '../../services/monitoringService';
import { fetchInstruments } from '../../services/instrumentService';
import type { MonitoringSetup, MonitoringUpdate, State, Transition } from '../../types/monitoring';
import type { Instrument } from '../../types/instrument';
import type { InstrumentConfiguration, Mode } from '../../types/instrumentConfig';
import { StateMachineEditor } from './StateMachineEditor';
import { validateStateMachine, formatValidationMessage } from '../../utils/stateMachineValidation';

export function MonitoringSetupList(): ReactElement {
  const [setups, setSetups] = useState<MonitoringSetup[]>([]);
  const setupsRef = useRef<MonitoringSetup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusById, setStatusById] = useState<Record<number, { running: boolean; last_success?: string | null; last_error?: string | null }>>({});
  const [smStatusById, setSmStatusById] = useState<Record<number, StateMachineStatus>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [editForm, setEditForm] = useState<{
    name: string;
    frequency_seconds: number;
    states: State[];
    transitions: Transition[];
    initialStateID?: string;
  }>({
    name: '',
    frequency_seconds: 1,
    states: [],
    transitions: [],
    initialStateID: undefined,
  });

  const loadSetups = async () => {
    try {
      const data = await fetchMonitoringSetups();
      setSetups(data);
      setupsRef.current = data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load monitoring setups');
    }
  };

  useEffect(() => {
    loadSetups();
    fetchInstruments().then(setInstruments).catch(console.error);
    let timer: number | undefined;
    const refreshHandler = () => {
      loadSetups();
    };
    window.addEventListener('monitoring:refresh', refreshHandler as EventListener);
    const poll = async () => {
      try {
        // Fetch statuses for current setups
        const entries = await Promise.all(
          (setupsRef.current || []).map(async (s) => {
            try {
              const st = await getMonitoringStatus(s.id);
              return [s.id, st] as const;
            } catch {
              return [s.id, { running: false }] as const;
            }
          })
        );
        const next: Record<number, any> = {};
        for (const [id, st] of entries) next[id] = st;
        if (entries.length > 0) setStatusById(next);

        // Fetch state machine statuses for setups that have state machines
        const smEntries = await Promise.all(
          (setupsRef.current || [])
            .filter(s => s.states && s.states.length > 0)
            .map(async (s) => {
              try {
                const smSt = await getStateMachineStatus(s.id);
                return [s.id, smSt] as const;
              } catch {
                return null;
              }
            })
        );
        const nextSm: Record<number, StateMachineStatus> = {};
        for (const entry of smEntries) {
          if (entry) {
            const [id, smSt] = entry;
            nextSm[id] = smSt;
          }
        }
        if (Object.keys(nextSm).length > 0) setSmStatusById(nextSm);
      } catch {
        // ignore polling errors
      } finally {
        timer = window.setTimeout(poll, 2000);
      }
    };
    timer = window.setTimeout(poll, 200);
    return () => {
      if (timer) window.clearTimeout(timer);
      window.removeEventListener('monitoring:refresh', refreshHandler as EventListener);
    };
  }, []);

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete monitoring setup "${name}"?`)) {
      return;
    }
    try {
      await deleteMonitoringSetup(id);
      loadSetups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete monitoring setup');
    }
  };

  const handleEdit = (setup: MonitoringSetup) => {
    setEditingId(setup.id);
    setEditForm({
      name: setup.name,
      // Convert stored frequency (Hz) to interval in seconds for editing
      frequency_seconds: setup.frequency_hz > 0 ? 1 / setup.frequency_hz : 0,
      states: setup.states || [],
      transitions: setup.transitions || [],
      initialStateID: setup.initialStateID,
    });
  };

  const handleUpdate = async (id: number) => {
    try {
      // Validate state machine if states are defined
      if (editForm.states.length > 0) {
        const validation = validateStateMachine(editForm.states, editForm.transitions, editForm.initialStateID);
        
        if (!validation.valid) {
          const message = formatValidationMessage(validation);
          setError(`State machine validation failed:\n\n${message}`);
          return;
        }

        // Show warnings but allow proceeding
        if (validation.warnings.length > 0) {
          const message = formatValidationMessage({ valid: true, errors: [], warnings: validation.warnings });
          if (!confirm(`State machine has warnings:\n\n${message}\n\nDo you want to save anyway?`)) {
            return;
          }
        }
      }

      // Convert interval seconds back to frequency_hz for the API
      const freqHz = editForm.frequency_seconds > 0 ? 1 / editForm.frequency_seconds : 0;
      const updateData: MonitoringUpdate = {
        name: editForm.name,
        frequency_hz: freqHz,
      };
      
      // Include state machine data if it exists
      if (editForm.states.length > 0) {
        updateData.states = editForm.states;
        updateData.transitions = editForm.transitions;
        updateData.initialStateID = editForm.initialStateID;
      }
      
      await updateMonitoringSetup(id, updateData);
      setEditingId(null);
      loadSetups();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update monitoring setup');
    }
  };

  const refreshStatus = async (id: number) => {
    try {
      const st = await getMonitoringStatus(id);
      setStatusById((prev) => ({ ...prev, [id]: st }));
    } catch {
      // ignore
    }
  };

  const handleStart = async (id: number) => {
    try {
      await startMonitoringSetup(id);
      await refreshStatus(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start monitoring');
    }
  };

  const handleStop = async (id: number) => {
    try {
      await stopMonitoringSetup(id);
      await refreshStatus(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop monitoring');
    }
  };

  const handleReset = async (id: number, name: string) => {
    if (!confirm(`Reset readings for setup "${name}"? This cannot be undone.`)) return;
    try {
      await resetMonitoringReadings(id);
      // No UI list change; perhaps show a toast in future
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reset readings');
    }
  };

  const handleStartStateMachine = async (id: number) => {
    try {
      // Pre-start validation
      const setup = setups.find(s => s.id === id);
      if (setup && setup.states && setup.states.length > 0) {
        const validation = validateStateMachine(setup.states, setup.transitions || [], setup.initialStateID);
        
        if (!validation.valid) {
          const message = formatValidationMessage(validation);
          setError(`Cannot start state machine:\n\n${message}`);
          return;
        }

        // Show warnings but allow proceeding
        if (validation.warnings.length > 0) {
          const message = formatValidationMessage({ valid: true, errors: [], warnings: validation.warnings });
          if (!confirm(`State machine has warnings:\n\n${message}\n\nDo you want to start anyway?`)) {
            return;
          }
        }
      }

      await startStateMachine(id);
      // Refresh state machine status
      const smSt = await getStateMachineStatus(id);
      setSmStatusById((prev) => ({ ...prev, [id]: smSt }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start state machine');
    }
  };

  const handleStopStateMachine = async (id: number) => {
    try {
      await stopStateMachine(id);
      // Refresh state machine status
      const smSt = await getStateMachineStatus(id);
      setSmStatusById((prev) => ({ ...prev, [id]: smSt }));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to stop state machine');
    }
  };

  const handleDownloadCsv = async (setup: MonitoringSetup) => {
    try {
      const { exportMonitoringCsv } = await import('../../services/monitoringService');
      const blob = await exportMonitoringCsv(setup.id);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      const safeName = (setup.name || 'setup').replace(/\s+/g, '_');
      a.href = url;
      a.download = `monitoring_${setup.id}_${safeName}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to download CSV');
    }
  };

  if (error) {
    return <div className="rounded border border-red-500 bg-red-900/40 p-4 text-red-200">{error}</div>;
  }

  if (setups.length === 0) {
    return <div className="text-sm text-slate-300">No monitoring setups yet.</div>;
  }

  return (
    <div className="space-y-4">
      {setups.map((setup) => (
        <article key={setup.id} className="rounded border border-slate-800 bg-slate-900 p-4">
          {editingId === setup.id ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-slate-700 pb-3">
                <h3 className="text-lg font-semibold text-primary-light">Edit Monitoring Setup</h3>
                <button
                  onClick={() => setEditingId(null)}
                  className="text-slate-400 hover:text-slate-200 text-2xl font-bold leading-none"
                >
                  ×
                </button>
              </div>
              
              <div className="space-y-3">
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Name</label>
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-300 mb-1">Collection interval (seconds)</label>
                  <input
                    type="number"
                    min="0.1"
                    step="0.1"
                    value={editForm.frequency_seconds}
                    onChange={(e) => setEditForm({ ...editForm, frequency_seconds: Number(e.target.value) })}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>

              {/* State Machine Editor */}
              {(editForm.states.length > 0 || setup.states) && (
                <div className="border-t border-slate-700 pt-4">
                  <StateMachineEditor
                    states={editForm.states}
                    transitions={editForm.transitions}
                    initialStateID={editForm.initialStateID}
                    instruments={instruments.filter((inst) => 
                      setup.instruments?.some((t) => t.instrument_id === inst.id) ||
                      setup.instrument_id === inst.id
                    )}
                    onChange={(newStates, newInitialStateID) => {
                      setEditForm({ 
                        ...editForm, 
                        states: newStates, 
                        initialStateID: newInitialStateID 
                      });
                    }}
                    onTransitionsChange={(newTransitions) => {
                      setEditForm({ ...editForm, transitions: newTransitions });
                    }}
                  />
                </div>
              )}

              <div className="flex gap-2 pt-3 border-t border-slate-700">
                <button
                  onClick={() => handleUpdate(setup.id)}
                  className="rounded bg-primary-light px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-primary"
                >
                  Save Changes
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded bg-slate-700 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-600"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <>
              <header className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-primary-light">{setup.name}</h3>
                  <span className="text-xs uppercase text-slate-400">
                    {setup.frequency_hz > 0 ? `${(1 / setup.frequency_hz).toFixed(2)} s` : '—'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleEdit(setup)}
                    className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(setup.id, setup.name)}
                    className="rounded bg-red-900/40 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-900/60"
                  >
                    Delete
                  </button>
                </div>
              </header>
              {setup.states && setup.states.length > 0 && (
                <div className="mt-3 rounded border border-primary-light/30 bg-primary-dark/20 p-3">
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-semibold text-primary-light">State Machine Enabled</div>
                    {smStatusById[setup.id]?.is_running && (
                      <span className="text-xs font-medium text-green-400 flex items-center gap-1">
                        <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                        Running
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-xs mb-2">
                    <div>
                      <span className="text-slate-400">States:</span>
                      <span className="ml-1 text-white font-medium">{setup.states.length}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Transitions:</span>
                      <span className="ml-1 text-white font-medium">{setup.transitions?.length || 0}</span>
                    </div>
                    <div>
                      <span className="text-slate-400">Initial:</span>
                      <span className="ml-1 text-white font-medium">
                        {setup.states.find(s => s.id === setup.initialStateID)?.name || 'None'}
                      </span>
                    </div>
                  </div>
                  {smStatusById[setup.id]?.is_running && smStatusById[setup.id]?.current_state_id && (
                    <div className="pt-2 border-t border-primary-light/20">
                      <div className="text-xs">
                        <span className="text-slate-400">Current State:</span>
                        <span className="ml-1 text-primary-light font-semibold">
                          {setup.states.find(s => s.id === smStatusById[setup.id].current_state_id)?.name || smStatusById[setup.id].current_state_id}
                        </span>
                      </div>
                      {smStatusById[setup.id]?.time_in_current_state !== null && (
                        <div className="text-xs mt-1">
                          <span className="text-slate-400">Time in state:</span>
                          <span className="ml-1 text-white">{smStatusById[setup.id].time_in_current_state!.toFixed(1)}s</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              {Array.isArray(setup.instruments) && setup.instruments.length > 0 ? (
                <div className="mt-2 text-sm text-slate-300">
                  <div className="text-xs text-slate-400 mb-1">Targets:</div>
                  <ul className="list-disc pl-5 space-y-1">
                    {setup.instruments.map((t, i) => (
                      <li key={i}>
                        {t.instrument?.name ?? `#${t.instrument_id}`} – Mode:{' '}
                        {String((t.parameters as any)?.modeName || (t.parameters as any)?.modeId || '—')}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <>
                  <p className="mt-1 text-sm text-slate-300">
                    Instrument: {setup.instrument?.name ?? `#${setup.instrument_id}`}
                  </p>
                  {(setup as any).parameters && (
                    <p className="mt-1 text-xs text-slate-400">
                      Mode: {String((setup as any).parameters?.modeName || (setup as any).parameters?.modeId || '—')}
                    </p>
                  )}
                </>
              )}
              <div className="mt-2 flex items-center justify-between">
                <div className="text-xs text-slate-400">
                  {statusById[setup.id]?.running ? (
                    <span className="text-green-400">Running</span>
                  ) : (
                    <span className="text-slate-400">Stopped</span>
                  )}
                  {statusById[setup.id]?.last_success && (
                    <span className="ml-2">Last success: {new Date(statusById[setup.id]!.last_success as string).toLocaleTimeString()}</span>
                  )}
                  {statusById[setup.id]?.last_error && (
                    <span className="ml-2 text-red-400">Error: {statusById[setup.id]!.last_error}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {setup.states && setup.states.length > 0 ? (
                    <>
                      <button
                        onClick={() => handleStartStateMachine(setup.id)}
                        disabled={smStatusById[setup.id]?.is_running}
                        className="rounded bg-primary-light/20 px-2 py-1 text-xs font-medium text-primary-light hover:bg-primary-light/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Start SM
                      </button>
                      <button
                        onClick={() => handleStopStateMachine(setup.id)}
                        disabled={!smStatusById[setup.id]?.is_running}
                        className="rounded bg-yellow-500/20 px-2 py-1 text-xs font-medium text-yellow-300 hover:bg-yellow-500/30 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Stop SM
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => handleStart(setup.id)}
                        className="rounded bg-emerald-500/20 px-2 py-1 text-xs font-medium text-emerald-300 hover:bg-emerald-500/30"
                      >
                        Start
                      </button>
                      <button
                        onClick={() => handleStop(setup.id)}
                        className="rounded bg-yellow-500/20 px-2 py-1 text-xs font-medium text-yellow-300 hover:bg-yellow-500/30"
                      >
                        Stop
                      </button>
                    </>
                  )}
                  <button
                    onClick={() => handleDownloadCsv(setup)}
                    className="rounded bg-blue-500/20 px-2 py-1 text-xs font-medium text-blue-300 hover:bg-blue-500/30"
                  >
                    Download CSV
                  </button>
                  <button
                    onClick={() => handleReset(setup.id, setup.name)}
                    className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600"
                  >
                    Reset
                  </button>
                </div>
              </div>
            </>
          )}
        </article>
      ))}
    </div>
  );
}
