import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { fetchMonitoringSetups, deleteMonitoringSetup, updateMonitoringSetup } from '../../services/monitoringService';
import type { MonitoringSetup } from '../../types/monitoring';

export function MonitoringSetupList(): ReactElement {
  const [setups, setSetups] = useState<MonitoringSetup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; frequency_hz: number }>({
    name: '',
    frequency_hz: 1,
  });

  const loadSetups = () => {
    fetchMonitoringSetups()
      .then(setSetups)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    loadSetups();
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
                <h3 className="font-semibold text-primary-light">{setup.name}</h3>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase text-slate-400">{setup.frequency_hz} Hz</span>
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
              <p className="mt-1 text-sm text-slate-300">
                Instrument: {setup.instrument?.name ?? `#${setup.instrument_id}`}
              </p>
            </>
          )}
        </article>
      ))}
    </div>
  );
}
