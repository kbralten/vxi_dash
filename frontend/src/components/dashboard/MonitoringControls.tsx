import { useState } from 'react';
import type { ReactElement } from 'react';

interface MonitoringControlsProps {
  setups: Array<{ id: number; name: string }>;
  onStart: (setupId: number) => Promise<void>;
  onStop: (setupId: number) => Promise<void>;
  onCollect: (setupId: number) => Promise<void>;
}

export function MonitoringControls({
  setups,
  onStart,
  onStop,
  onCollect,
}: MonitoringControlsProps): ReactElement {
  const [activeSetups, setActiveSetups] = useState<Set<number>>(new Set());
  const [loading, setLoading] = useState<number | null>(null);

  const handleStart = async (setupId: number) => {
    setLoading(setupId);
    try {
      await onStart(setupId);
      setActiveSetups(prev => new Set(prev).add(setupId));
    } finally {
      setLoading(null);
    }
  };

  const handleStop = async (setupId: number) => {
    setLoading(setupId);
    try {
      await onStop(setupId);
      setActiveSetups(prev => {
        const next = new Set(prev);
        next.delete(setupId);
        return next;
      });
    } finally {
      setLoading(null);
    }
  };

  const handleCollect = async (setupId: number) => {
    setLoading(setupId);
    try {
      await onCollect(setupId);
    } finally {
      setLoading(null);
    }
  };

  if (setups.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6 text-center">
        <p className="text-slate-400">No monitoring setups configured.</p>
        <p className="mt-2 text-sm text-slate-500">
          Create a monitoring setup to start collecting data.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900">
      <div className="border-b border-slate-800 px-6 py-3">
        <h2 className="text-lg font-medium text-slate-100">Monitoring Controls</h2>
      </div>

      <div className="divide-y divide-slate-800">
        {setups.map(setup => {
          const isActive = activeSetups.has(setup.id);
          const isLoading = loading === setup.id;

          return (
            <div key={setup.id} className="px-6 py-4">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h3 className="font-medium text-slate-100">{setup.name}</h3>
                  {isActive && (
                    <span className="mt-1 inline-block text-xs text-emerald-400">
                      ● Active
                    </span>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleCollect(setup.id)}
                    disabled={isLoading}
                    className="rounded bg-blue-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    Collect Now
                  </button>

                  {isActive ? (
                    <button
                      onClick={() => handleStop(setup.id)}
                      disabled={isLoading}
                      className="rounded bg-red-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                    >
                      {isLoading ? 'Stopping...' : 'Stop'}
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStart(setup.id)}
                      disabled={isLoading}
                      className="rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {isLoading ? 'Starting...' : 'Start'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
