import type { ReactElement } from 'react';
import type { Reading } from '../../services/dataService';

interface ReadingsTableProps {
  readings: Reading[];
}

export function ReadingsTable({ readings }: ReadingsTableProps): ReactElement {
  if (readings.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
        <p className="text-slate-400">No recent readings</p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-6 py-3">
        <h2 className="text-lg font-medium text-slate-100">Recent Readings</h2>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="border-b border-slate-800 bg-slate-950">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">
                Time
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">
                Setup
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">
                Instrument
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">
                Mode
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium uppercase text-slate-400">
                Readings
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {readings.slice().reverse().map((reading, index) => (
              <tr key={index} className="hover:bg-slate-800/50">
                <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-300">
                  {new Date(reading.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-4 py-3 text-sm text-slate-100">
                  {reading.setup_name}
                </td>
                <td className="px-4 py-3 text-sm text-slate-300">
                  {reading.instrument_name}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span className="rounded bg-slate-700 px-2 py-1 text-xs font-medium text-slate-200">
                    {typeof reading.mode === 'string' ? reading.mode : (reading.mode?.name ?? 'Unknown mode')}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {reading.error ? (
                    <span className="text-sm text-red-400">{reading.error}</span>
                  ) : (
                    <div className="flex flex-wrap gap-3">
                      {Object.entries(reading.readings || {}).map(([signal, data]) => (
                        <div key={signal} className="text-sm">
                          <span className="font-medium text-slate-300">{signal}:</span>{' '}
                          {data.error ? (
                            <span className="text-red-400">Error</span>
                          ) : (
                            <>
                              <span className="text-primary-light">
                                {data.value?.toFixed(2) ?? 'N/A'}
                              </span>
                              <span className="ml-1 text-slate-500">{data.unit}</span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
