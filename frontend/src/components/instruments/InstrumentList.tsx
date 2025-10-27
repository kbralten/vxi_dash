import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { fetchInstruments, deleteInstrument, updateInstrument } from '../../services/instrumentService';
import type { Instrument } from '../../types/instrument';
import { InstrumentWizard } from './InstrumentWizard';

export function InstrumentList(): ReactElement {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [showWizard, setShowWizard] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<{ name: string; ip: string; identifier: string; description: string }>({
    name: '',
    ip: '',
    identifier: '',
    description: '',
  });

  const loadInstruments = () => {
    fetchInstruments()
      .then(setInstruments)
      .catch((err: Error) => setError(err.message));
  };

  useEffect(() => {
    loadInstruments();
  }, []);

  const handleWizardComplete = () => {
    setShowWizard(false);
    loadInstruments();
  };

  const handleDelete = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete instrument "${name}"?`)) {
      return;
    }
    try {
      await deleteInstrument(id);
      loadInstruments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete instrument');
    }
  };

  const handleEdit = (instrument: Instrument) => {
    setEditingId(instrument.id);
    const [hostPart = '', dev = ''] = (instrument.address || '').split('/');
    const ip = hostPart.split(':')[0] || '';
    setEditForm({
      name: instrument.name,
      ip,
      identifier: dev,
      description: instrument.description || '',
    });
  };

  const handleUpdate = async (id: number) => {
    try {
      const address = `${editForm.ip}/${editForm.identifier}`;
      await updateInstrument(id, { name: editForm.name, address, description: editForm.description });
      setEditingId(null);
      loadInstruments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update instrument');
    }
  };

  const handleToggleActive = async (instrument: Instrument) => {
    try {
      await updateInstrument(instrument.id, { is_active: !instrument.is_active });
      loadInstruments();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update instrument');
    }
  };

  if (showWizard) {
    return (
      <InstrumentWizard
        onComplete={handleWizardComplete}
        onCancel={() => setShowWizard(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-white">Instruments</h2>
        <button
          type="button"
          onClick={() => setShowWizard(true)}
          className="rounded bg-primary-light px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-primary-dark hover:text-white"
        >
          + Configure New Instrument
        </button>
      </div>

      {error && (
        <div className="rounded border border-red-500 bg-red-900/40 p-4 text-red-200">{error}</div>
      )}

      {instruments.length === 0 && !error && (
        <div className="rounded border border-dashed border-slate-700 bg-slate-800/50 p-8 text-center text-sm text-slate-300">
          No instruments configured yet. Use the Configure New Instrument button to get started.
        </div>
      )}

      {instruments.map((instrument) => (
        <article key={instrument.id} className="rounded border border-slate-800 bg-slate-900 p-4">
          {editingId === instrument.id ? (
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
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs text-slate-400 mb-1">IP</label>
                  <input
                    type="text"
                    value={editForm.ip}
                    onChange={(e) => setEditForm({ ...editForm, ip: e.target.value })}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-400 mb-1">Identifier</label>
                  <input
                    type="text"
                    value={editForm.identifier}
                    onChange={(e) => setEditForm({ ...editForm, identifier: e.target.value })}
                    className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-xs text-slate-400 mb-1">Description</label>
                <textarea
                  value={editForm.description}
                  onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                  rows={2}
                  className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white"
                />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => handleUpdate(instrument.id)}
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
                  <h3 className="text-base font-semibold text-primary-light">{instrument.name}</h3>
                  <button
                    onClick={() => handleToggleActive(instrument)}
                    className={`rounded px-2 py-0.5 text-xs font-medium ${
                      instrument.is_active
                        ? 'bg-green-900/40 text-green-400'
                        : 'bg-slate-700 text-slate-400'
                    }`}
                  >
                    {instrument.is_active ? 'Active' : 'Inactive'}
                  </button>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs uppercase text-slate-400">#{instrument.id}</span>
                  <button
                    onClick={() => handleEdit(instrument)}
                    className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-300 hover:bg-slate-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleDelete(instrument.id, instrument.name)}
                    className="rounded bg-red-900/40 px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-900/60"
                  >
                    Delete
                  </button>
                </div>
              </header>
              <p className="mt-2 text-sm text-slate-300">{instrument.address}</p>
              {instrument.description && !instrument.description.includes('[CONFIG]') && (
                <p className="mt-1 text-xs text-slate-400">{instrument.description}</p>
              )}
            </>
          )}
        </article>
      ))}
    </div>
  );
}
