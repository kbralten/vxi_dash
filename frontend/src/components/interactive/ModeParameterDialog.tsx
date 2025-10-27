import { useState } from 'react';
import type { ReactElement } from 'react';

interface ModeParameterDialogProps {
  mode: {
    name: string;
    parameters: string[];
  };
  onSubmit: (parameters: Record<string, string>) => void;
  onCancel: () => void;
}

export function ModeParameterDialog({
  mode,
  onSubmit,
  onCancel,
}: ModeParameterDialogProps): ReactElement {
  const [parameters, setParameters] = useState<Record<string, string>>(
    mode.parameters.reduce((acc, param) => ({ ...acc, [param]: '' }), {})
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(parameters);
  };

  const handleChange = (param: string, value: string) => {
    setParameters((prev) => ({ ...prev, [param]: value }));
  };

  const allParametersFilled = mode.parameters.every(
    (param) => parameters[param]?.trim() !== ''
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <div className="w-full max-w-md rounded-lg border border-slate-700 bg-slate-900 p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-medium text-slate-100">
          Start Mode: {mode.name}
        </h2>

        <p className="mb-4 text-sm text-slate-400">
          This mode requires the following parameters:
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {mode.parameters.map((param) => (
            <div key={param}>
              <label className="mb-1 block text-sm font-medium text-slate-300">
                {param}
              </label>
              <input
                type="text"
                value={parameters[param]}
                onChange={(e) => handleChange(param, e.target.value)}
                placeholder={`Enter ${param}`}
                className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                autoFocus={param === mode.parameters[0]}
              />
            </div>
          ))}

          <div className="flex gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 rounded border border-slate-700 bg-slate-800 px-4 py-2 text-sm font-medium text-slate-300 hover:bg-slate-700"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!allParametersFilled}
              className="flex-1 rounded bg-primary-light px-4 py-2 text-sm font-medium text-slate-900 hover:bg-primary-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
            >
              Start Mode
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
