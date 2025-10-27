import type { ReactElement } from 'react';
import type { Signal } from '../../../types/instrumentConfig';

interface Props {
  signals: Signal[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<Signal>) => void;
  onRemove: (id: string) => void;
}

export function SignalsStep({ signals, onAdd, onUpdate, onRemove }: Props): ReactElement {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Define the signals this instrument can measure. Each signal requires a name and a SCPI query command.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="rounded bg-primary-light px-3 py-1.5 text-sm font-medium text-slate-900 transition hover:bg-primary-dark hover:text-white"
        >
          + Add Signal
        </button>
      </div>

      {signals.length === 0 && (
        <div className="rounded border border-dashed border-slate-700 bg-slate-800/50 p-6 text-center text-sm text-slate-400">
          No signals defined yet. Use the Add Signal button to get started.
        </div>
      )}

      {signals.map((signal, index) => (
        <div
          key={signal.id}
          className="rounded border border-slate-700 bg-slate-800/50 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-slate-500">
              Signal {index + 1}
            </span>
            <button
              type="button"
              onClick={() => onRemove(signal.id)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Signal Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={signal.name}
                onChange={(e) => onUpdate(signal.id, { name: e.target.value })}
                placeholder="e.g., Output Voltage"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">
                Measure Command <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={signal.measureCommand}
                onChange={(e) => onUpdate(signal.id, { measureCommand: e.target.value })}
                placeholder="e.g., MEAS:VOLT?"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm font-mono text-white placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
              />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
