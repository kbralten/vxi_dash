import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import { fetchDashboardSummary } from '../../services/dashboardService';
import type { DashboardSummary } from '../../types/dashboard';
import { LiveDashboard } from './LiveDashboard';

export function DashboardView(): ReactElement {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<'summary' | 'live'>('live');

  useEffect(() => {
    let mounted = true;
    fetchDashboardSummary()
      .then((data) => {
        if (mounted) {
          setSummary(data);
        }
      })
      .catch((err: Error) => {
        setError(err.message);
      });
    return () => {
      mounted = false;
    };
  }, []);

  if (error) {
    return <div className="rounded border border-red-500 bg-red-900/40 p-4 text-red-200">{error}</div>;
  }

  return (
    <div className="space-y-6">
      {/* View Selector */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('live')}
          className={`rounded px-4 py-2 text-sm font-medium transition ${
            view === 'live'
              ? 'bg-primary-light text-slate-900'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Live Dashboard
        </button>
        <button
          onClick={() => setView('summary')}
          className={`rounded px-4 py-2 text-sm font-medium transition ${
            view === 'summary'
              ? 'bg-primary-light text-slate-900'
              : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
          }`}
        >
          Summary
        </button>
      </div>

      {/* Live Dashboard View */}
      {view === 'live' && <LiveDashboard />}

      {/* Summary View */}
      {view === 'summary' && summary && (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <Card title="Active Monitoring" value={summary.active_monitoring_setups} />
            <Card title="Connected Instruments" value={summary.connected_instruments} />
            <Card title="Last Updated" value={new Date(summary.timestamp).toLocaleString()} />
          </section>

          <section>
            <h2 className="mb-3 text-lg font-semibold">Monitoring Setups</h2>
            <div className="space-y-3">
              {summary.setups.map((setup) => (
                <div key={setup.id} className="rounded border border-slate-800 bg-slate-900 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-base font-medium text-primary-light">{setup.name}</h3>
                      <p className="text-sm text-slate-300">
                        {setup.instrument?.name ?? 'Instrument N/A'} • {setup.frequency_hz > 0 ? `${(1 / setup.frequency_hz).toFixed(2)} s` : '—'}
                      </p>
                    </div>
                    <div className="rounded bg-slate-800 px-2 py-1 text-xs uppercase tracking-wide text-slate-300">
                      #{setup.id}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </>
      )}
    </div>
  );
}

function Card({ title, value }: { title: string; value: string | number }): ReactElement {
  return (
    <div className="rounded border border-slate-800 bg-slate-900 p-5">
      <dt className="text-sm text-slate-400">{title}</dt>
      <dd className="mt-2 text-2xl font-semibold text-primary-light">{value}</dd>
    </div>
  );
}
