import type { ReactElement } from 'react';
import type { Signal, Mode, SignalModeConfig } from '../../../types/instrumentConfig';

interface Props {
  signals: Signal[];
  modes: Mode[];
  signalModeConfigs: SignalModeConfig[];
  onUpdateConfig: (modeId: string, signalId: string, updates: Partial<SignalModeConfig>) => void;
}

// Allow only base units in configuration; use Scaling Factor to convert from prefixed units
const commonUnits = [
  'V', // Volts
  'A', // Amps
  'Ω', // Ohms
  'Hz', // Hertz
  'W', // Watts
  'dB', // Decibels (relative)
  '°C', // Celsius (prefer base without offsets)
  's', // seconds
];

export function SignalModeMatrixStep({
  signals,
  modes,
  signalModeConfigs,
  onUpdateConfig,
}: Props): ReactElement {
  const getConfig = (modeId: string, signalId: string): SignalModeConfig | undefined => {
    return signalModeConfigs.find((c) => c.modeId === modeId && c.signalId === signalId);
  };

  if (signals.length === 0 || modes.length === 0) {
    return (
      <div className="rounded border border-dashed border-slate-700 bg-slate-800/50 p-8 text-center">
        <p className="text-sm text-slate-400">
          {signals.length === 0 && modes.length === 0
            ? 'You need to define at least one signal and one mode first.'
            : signals.length === 0
            ? 'You need to define at least one signal first.'
            : 'You need to define at least one mode first.'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-400">
        Configure how each signal behaves in each mode. Leave cells empty if a signal is not
        applicable to a particular mode.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-slate-700">
              <th className="sticky left-0 z-10 bg-slate-900 p-3 text-left font-medium text-slate-300">
                Mode / Signal
              </th>
              {signals.map((signal) => (
                <th
                  key={signal.id}
                  className="border-l border-slate-700 bg-slate-800/50 p-3 text-left font-medium text-slate-300"
                >
                  <div className="min-w-[200px]">
                    <div className="font-semibold">{signal.name}</div>
                    <div className="mt-1 font-mono text-xs text-slate-500">
                      {signal.measureCommand}
                    </div>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {modes.map((mode) => (
              <tr key={mode.id} className="border-b border-slate-700">
                <td className="sticky left-0 z-10 bg-slate-900 p-3 font-medium text-slate-300">
                  <div className="min-w-[150px]">{mode.name}</div>
                </td>
                {signals.map((signal) => {
                  const config = getConfig(mode.id, signal.id);
                  return (
                    <td
                      key={signal.id}
                      className="border-l border-slate-700 bg-slate-800/20 p-3"
                    >
                      <div className="space-y-2">
                        <div>
                          <label className="mb-1 block text-xs text-slate-400">Unit</label>
                          <select
                            value={config?.unit || ''}
                            onChange={(e) =>
                              onUpdateConfig(mode.id, signal.id, { unit: e.target.value })
                            }
                            className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                          >
                            <option value="">— Not used —</option>
                            {commonUnits.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </div>

                        {config?.unit && config.unit !== '' && (
                          <div>
                            <label className="mb-1 block text-xs text-slate-400">
                              Scaling Factor
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={config?.scalingFactor ?? 1}
                              onChange={(e) =>
                                onUpdateConfig(mode.id, signal.id, {
                                  scalingFactor: parseFloat(e.target.value) || 1,
                                })
                              }
                              className="w-full rounded border border-slate-700 bg-slate-800 px-2 py-1.5 text-sm text-white focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
                            />
                          </div>
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="rounded bg-slate-800/30 p-4 text-xs text-slate-400">
        <p className="font-medium">Notes:</p>
        <ul className="mt-1 list-disc space-y-1 pl-5">
          <li>Choose base units only (e.g., V, A, Ω, Hz, W, °C, s).</li>
          <li>Use the Scaling Factor to convert prefixed units from your instrument into the base unit.</li>
          <li>Example: if your instrument returns millivolts (mV) but you want Volts (V), set Unit to V and Scaling Factor to 0.001. A raw 250 mV becomes 0.25 V.</li>
        </ul>
      </div>
    </div>
  );
}
