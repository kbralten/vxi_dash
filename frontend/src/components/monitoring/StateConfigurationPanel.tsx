import { useState } from 'react';
import type { ReactElement } from 'react';
import type { State, StateInstrumentSettings } from '../../types/monitoring';
import type { Instrument } from '../../types/instrument';
import type { InstrumentConfiguration, Mode } from '../../types/instrumentConfig';

interface StateConfigurationPanelProps {
  state: State;
  instruments: Instrument[];
  onChange: (updatedState: State) => void;
  onDelete: () => void;
}

export function StateConfigurationPanel({
  state,
  instruments,
  onChange,
  onDelete,
}: StateConfigurationPanelProps): ReactElement {
  const [isExpanded, setIsExpanded] = useState(true);

  const handleNameChange = (name: string) => {
    onChange({ ...state, name });
  };

  const handleEndStateToggle = () => {
    onChange({ ...state, isEndState: !state.isEndState });
  };

  const handleInstrumentModeChange = (
    instrumentId: number,
    modeId: string,
    config: InstrumentConfiguration | null
  ) => {
    const mode = config?.modes?.find((m) => m.id === modeId);
    const defaultParams: Record<string, unknown> = {};
    
    // Initialize parameters with empty strings
    if (mode?.parameters) {
      for (const param of mode.parameters) {
        defaultParams[param.name] = '';
      }
    }

    const settings: StateInstrumentSettings = {
      ...state.instrumentSettings,
      [instrumentId]: {
        modeId,
        modeParams: defaultParams,
      },
    };

    onChange({ ...state, instrumentSettings: settings });
  };

  const handleInstrumentParamChange = (
    instrumentId: number,
    paramName: string,
    value: string
  ) => {
    const currentSettings = state.instrumentSettings[instrumentId];
    if (!currentSettings) return;

    const settings: StateInstrumentSettings = {
      ...state.instrumentSettings,
      [instrumentId]: {
        ...currentSettings,
        modeParams: {
          ...currentSettings.modeParams,
          [paramName]: value,
        },
      },
    };

    onChange({ ...state, instrumentSettings: settings });
  };

  const parseInstrumentConfig = (instrument: Instrument): InstrumentConfiguration | null => {
    try {
      return instrument.description ? JSON.parse(instrument.description) : null;
    } catch {
      return null;
    }
  };

  return (
    <div className="rounded border border-slate-700 bg-slate-800/50 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsExpanded(!isExpanded)}
            className="text-slate-400 hover:text-slate-200"
          >
            {isExpanded ? '▼' : '▶'}
          </button>
          <input
            type="text"
            value={state.name}
            onChange={(e) => handleNameChange(e.target.value)}
            placeholder="State name"
            className="rounded border border-slate-600 bg-slate-900 px-3 py-1 text-sm font-semibold text-white"
          />
          {state.isEndState && (
            <span className="rounded bg-red-900/40 px-2 py-1 text-xs font-medium text-red-300">
              END STATE
            </span>
          )}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleEndStateToggle}
            className={`rounded px-3 py-1 text-xs font-medium ${
              state.isEndState
                ? 'bg-red-900/40 text-red-300 hover:bg-red-900/60'
                : 'bg-slate-700 text-slate-200 hover:bg-slate-600'
            }`}
          >
            {state.isEndState ? 'Unmark End' : 'Mark as End'}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="rounded bg-red-900/40 px-3 py-1 text-xs font-medium text-red-300 hover:bg-red-900/60"
          >
            Delete State
          </button>
        </div>
      </div>

      {isExpanded && (
        <div className="mt-4 space-y-4">
          <div>
            <h4 className="mb-2 text-sm font-medium text-slate-300">Instrument Configuration</h4>
            <p className="mb-3 text-xs text-slate-400">
              Configure the mode and parameters for each instrument when this state is active.
            </p>

            {instruments.length === 0 && (
              <p className="text-xs text-slate-500">No instruments available. Add instruments to the monitoring setup first.</p>
            )}

            <div className="space-y-3">
              {instruments.map((instrument) => {
                const config = parseInstrumentConfig(instrument);
                const instrumentSettings = state.instrumentSettings[instrument.id];
                const selectedMode = config?.modes?.find((m) => m.id === instrumentSettings?.modeId);

                return (
                  <div
                    key={instrument.id}
                    className="rounded border border-slate-700 bg-slate-900/40 p-3"
                  >
                    <div className="mb-2 text-sm font-medium text-slate-200">{instrument.name}</div>

                    {config?.modes && config.modes.length > 0 ? (
                      <>
                        <div className="mb-3">
                          <label className="mb-1 block text-xs text-slate-400">Mode</label>
                          <select
                            value={instrumentSettings?.modeId || ''}
                            onChange={(e) =>
                              handleInstrumentModeChange(instrument.id, e.target.value, config)
                            }
                            className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                          >
                            <option value="">Select mode...</option>
                            {config.modes.map((mode) => (
                              <option key={mode.id} value={mode.id}>
                                {mode.name}
                              </option>
                            ))}
                          </select>
                        </div>

                        {selectedMode && selectedMode.parameters && selectedMode.parameters.length > 0 && (
                          <div className="grid gap-3 md:grid-cols-2">
                            {selectedMode.parameters.map((param) => (
                              <div key={param.name}>
                                <label className="mb-1 block text-xs text-slate-400">
                                  {param.name}
                                </label>
                                <input
                                  type="text"
                                  value={
                                    (instrumentSettings?.modeParams[param.name] as string) || ''
                                  }
                                  onChange={(e) =>
                                    handleInstrumentParamChange(
                                      instrument.id,
                                      param.name,
                                      e.target.value
                                    )
                                  }
                                  className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm text-white"
                                  placeholder={`Enter ${param.name}...`}
                                />
                              </div>
                            ))}
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-xs text-slate-500">
                        This instrument has no configured modes.
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
