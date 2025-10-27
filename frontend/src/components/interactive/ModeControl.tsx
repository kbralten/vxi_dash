import { useState } from 'react';
import type { ReactElement } from 'react';
import { ModeParameterDialog } from './ModeParameterDialog';
import { sendCommand } from '../../services/instrumentService';

interface ModeControlProps {
  instrument: {
    id: number;
    name: string;
    description: string;
  };
}

interface Mode {
  name: string;
  enable: string;
  disable: string;
  parameters: string[];
}

interface ModeConfig {
  [modeName: string]: Mode;
}

export function ModeControl({ instrument }: ModeControlProps): ReactElement {
  const [activeMode, setActiveMode] = useState<string | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [showParameterDialog, setShowParameterDialog] = useState(false);
  const [selectedMode, setSelectedMode] = useState<Mode | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Parse instrument configuration
  let modes: ModeConfig = {};
  try {
    const config = JSON.parse(instrument.description);
    modes = config.mode || {};
  } catch (e) {
    console.error('Failed to parse instrument configuration:', e);
  }

  const modeNames = Object.keys(modes);

  if (modeNames.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <h2 className="mb-4 text-lg font-medium text-slate-100">Mode Control</h2>
        <p className="text-slate-400">No modes configured for this instrument.</p>
      </div>
    );
  }

  const handleStartMode = async (modeName: string) => {
    const mode = modes[modeName];
    
    // Check if mode requires parameters
    if (mode.parameters && mode.parameters.length > 0) {
      setSelectedMode({ ...mode, name: modeName });
      setShowParameterDialog(true);
    } else {
      await executeCommand(modeName, mode.enable, {});
    }
  };

  const handleStopMode = async (modeName: string) => {
    const mode = modes[modeName];
    await executeCommand(modeName, mode.disable, {});
  };

  const executeCommand = async (
    modeName: string,
    command: string,
    parameters: Record<string, string>
  ) => {
    setLoading(modeName);
    setError(null);

    try {
      // Replace parameters in command
      let finalCommand = command;
      for (const [key, value] of Object.entries(parameters)) {
        finalCommand = finalCommand.replace(`{${key}}`, value);
      }

      await sendCommand(instrument.id, finalCommand);
      
      // Update active mode based on command type
      if (command === modes[modeName].enable) {
        setActiveMode(modeName);
      } else if (command === modes[modeName].disable) {
        setActiveMode(null);
      }
    } catch (err: unknown) {
      let errorText = 'Command failed';
      if (err instanceof Error) {
        errorText = err.message;
      } else if (typeof err === 'object' && err !== null && 'response' in err) {
        const maybeResp = (err as unknown as Record<string, unknown>)['response'];
        if (maybeResp && typeof maybeResp === 'object') {
          const data = (maybeResp as Record<string, unknown>)['data'];
          const detail = data && typeof data === 'object' ? (data as Record<string, unknown>)['detail'] : undefined;
          if (typeof detail === 'string') {
            errorText = detail;
          } else {
            try {
              errorText = JSON.stringify(maybeResp);
            } catch (_) {
              // ignore
            }
          }
        }
      }
      setError(errorText);
    } finally {
      setLoading(null);
      setShowParameterDialog(false);
    }
  };

  const handleParameterSubmit = (parameters: Record<string, string>) => {
    if (selectedMode) {
      executeCommand(selectedMode.name, selectedMode.enable, parameters);
    }
  };

  return (
    <>
      <div className="rounded-lg border border-slate-800 bg-slate-900">
        <div className="border-b border-slate-800 px-6 py-3">
          <h2 className="text-lg font-medium text-slate-100">Mode Control</h2>
          {activeMode && (
            <p className="mt-1 text-sm text-emerald-400">
              Active Mode: <span className="font-medium">{activeMode}</span>
            </p>
          )}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded border border-red-800 bg-red-950 p-3 text-sm text-red-300">
              {error}
            </div>
          )}

          <div className="space-y-3">
            {modeNames.map((modeName) => {
              const mode = modes[modeName];
              const isActive = activeMode === modeName;
              const isLoading = loading === modeName;

              return (
                <div
                  key={modeName}
                  className={`rounded-lg border p-4 transition ${
                    isActive
                      ? 'border-emerald-700 bg-emerald-950/30'
                      : 'border-slate-700 bg-slate-800'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <h3 className="font-medium text-slate-100">{modeName}</h3>
                      {mode.parameters && mode.parameters.length > 0 && (
                        <p className="mt-1 text-xs text-slate-400">
                          Parameters: {mode.parameters.join(', ')}
                        </p>
                      )}
                      <div className="mt-2 space-y-1 font-mono text-xs text-slate-500">
                        <div>Enable: {mode.enable}</div>
                        <div>Disable: {mode.disable}</div>
                      </div>
                    </div>

                    <div className="ml-4 flex gap-2">
                      <button
                        type="button"
                        onClick={() => handleStartMode(modeName)}
                        disabled={isActive || isLoading}
                        className="rounded bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? 'Starting...' : 'Start'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleStopMode(modeName)}
                        disabled={!isActive || isLoading}
                        className="rounded bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {isLoading ? 'Stopping...' : 'Stop'}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {showParameterDialog && selectedMode && (
        <ModeParameterDialog
          mode={selectedMode}
          onSubmit={handleParameterSubmit}
          onCancel={() => {
            setShowParameterDialog(false);
            setSelectedMode(null);
          }}
        />
      )}
    </>
  );
}
