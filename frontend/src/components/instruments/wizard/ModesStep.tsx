import type { ReactElement } from 'react';
import type { Mode } from '../../../types/instrumentConfig';

interface Props {
  modes: Mode[];
  onAdd: () => void;
  onUpdate: (id: string, updates: Partial<Mode>) => void;
  onRemove: (id: string) => void;
}

// Extract parameter names from command strings like {param_name}
function extractParameters(commands: string): string[] {
  const regex = /\{([^}]+)\}/g;
  const params: string[] = [];
  let match;
  while ((match = regex.exec(commands)) !== null) {
    if (!params.includes(match[1])) {
      params.push(match[1]);
    }
  }
  return params;
}

export function ModesStep({ modes, onAdd, onUpdate, onRemove }: Props): ReactElement {
  const handleCommandUpdate = (id: string, field: 'enableCommands' | 'disableCommands', value: string) => {
    const mode = modes.find((m) => m.id === id);
    if (!mode) return;

    // Update the commands
    const updates: Partial<Mode> = { [field]: value };

    // Re-extract parameters from both enable and disable commands
    const enableCmds = field === 'enableCommands' ? value : mode.enableCommands;
    const disableCmds = field === 'disableCommands' ? value : mode.disableCommands;
    const allParams = [
      ...extractParameters(enableCmds),
      ...extractParameters(disableCmds),
    ];
    const uniqueParams = Array.from(new Set(allParams));
    updates.parameters = uniqueParams.map((name) => ({ name }));

    onUpdate(id, updates);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-400">
          Define operational modes with enable/disable commands. Use {'{'}param_name{'}'} to create parameters.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="rounded bg-primary-light px-3 py-1.5 text-sm font-medium text-slate-900 transition hover:bg-primary-dark hover:text-white"
        >
          + Add Mode
        </button>
      </div>

      {modes.length === 0 && (
        <div className="rounded border border-dashed border-slate-700 bg-slate-800/50 p-6 text-center text-sm text-slate-400">
          No modes defined yet. Use the Add Mode button to get started.
        </div>
      )}

      {modes.map((mode, index) => (
        <div
          key={mode.id}
          className="rounded border border-slate-700 bg-slate-800/50 p-4"
        >
          <div className="mb-3 flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-slate-500">
              Mode {index + 1}
            </span>
            <button
              type="button"
              onClick={() => onRemove(mode.id)}
              className="text-xs text-red-400 hover:text-red-300"
            >
              Remove
            </button>
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-slate-300">
                Mode Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                value={mode.name}
                onChange={(e) => onUpdate(mode.id, { name: e.target.value })}
                placeholder="e.g., Set Output"
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">
                Enable Commands
              </label>
              <textarea
                value={mode.enableCommands}
                onChange={(e) => handleCommandUpdate(mode.id, 'enableCommands', e.target.value)}
                placeholder={'VOLT {volts}\nCURR:LIM {amps}\nOUTP ON'}
                rows={4}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
              />
              <p className="mt-1 text-xs text-slate-500">
                One SCPI command per line. Use {'{'}param_name{'}'} for parameters.
              </p>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-300">
                Disable Commands
              </label>
              <textarea
                value={mode.disableCommands}
                onChange={(e) => handleCommandUpdate(mode.id, 'disableCommands', e.target.value)}
                placeholder="OUTP OFF"
                rows={3}
                className="mt-1 w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 font-mono text-sm text-white placeholder-slate-500 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
              />
            </div>

            {mode.parameters.length > 0 && (
              <div className="rounded bg-slate-900/50 p-3">
                <p className="mb-2 text-xs font-medium text-slate-400">
                  Detected Parameters:
                </p>
                <div className="flex flex-wrap gap-2">
                  {mode.parameters.map((param) => (
                    <span
                      key={param.name}
                      className="rounded bg-primary-dark/30 px-2 py-1 font-mono text-xs text-primary-light"
                    >
                      {param.name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
