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
} from '../../services/monitoringService';
import type { MonitoringSetup } from '../../types/monitoring';

export function MonitoringSetupList(): ReactElement {
  const [setups, setSetups] = useState<MonitoringSetup[]>([]);
  const setupsRef = useRef<MonitoringSetup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [statusById, setStatusById] = useState<Record<number, { running: boolean; last_success?: string | null; last_error?: string | null }>>({});
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; frequency_hz: number }>({
    name: '',
    frequency_hz: 1,
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
      frequency_hz: setup.frequency_hz,
    });
  };

  const handleUpdate = async (id: number) => {
    try {
      await updateMonitoringSetup(id, editForm);
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
            <div className="space-y-3">
              <div>
                <label className="block text-xs text-slate-400 mb-1">Name</label>
                <input
                  type="text"
                  value={editForm.name}
                  onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-400 mb-1">Frequency (Hz)</label>
                <input
                  type="number"
                  min="0.1"
                  step="0.1"
                  value={editForm.frequency_hz}
                  onChange={(e) => setEditForm({ ...editForm, frequency_hz: Number(e.target.value) })}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdate(setup.id)}
                  className="rounded bg-primary-light px-3 py-1 text-sm font-medium text-slate-900 hover:bg-primary-dark hover:text-white"
                >
                  Save
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  className="rounded bg-slate-700 px-3 py-1 text-sm font-medium text-slate-300 hover:bg-slate-600"
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
                  <span className="text-xs uppercase text-slate-400">{setup.frequency_hz} Hz</span>
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
