import { useState } from 'react';
import type { ReactElement } from 'react';
import { DashboardView } from './components/dashboard/DashboardView';
import { InstrumentList } from './components/instruments/InstrumentList';
import { MonitoringSetupList } from './components/monitoring/MonitoringSetupList';
import { MonitoringSetupForm } from './components/monitoring/MonitoringSetupForm';
import { InteractiveTerminal } from './components/interactive/InteractiveTerminal';

import './App.css';

export type ViewName = 'dashboard' | 'instruments' | 'monitoring' | 'interactive';

export default function App(): ReactElement {
  const [view, setView] = useState<ViewName>('dashboard');

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-slate-800 bg-slate-900">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <h1 className="text-xl font-semibold text-primary-light">VXI-11 Instrument Dashboard</h1>
          <nav className="flex gap-4">
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm transition hover:bg-primary-dark hover:text-white ${
                view === 'dashboard' ? 'bg-primary-light text-slate-900' : 'bg-slate-800'
              }`}
              onClick={() => setView('dashboard')}
            >
              Dashboard
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm transition hover:bg-primary-dark hover:text-white ${
                view === 'instruments' ? 'bg-primary-light text-slate-900' : 'bg-slate-800'
              }`}
              onClick={() => setView('instruments')}
            >
              Instruments
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm transition hover:bg-primary-dark hover:text-white ${
                view === 'monitoring' ? 'bg-primary-light text-slate-900' : 'bg-slate-800'
              }`}
              onClick={() => setView('monitoring')}
            >
              Monitoring
            </button>
            <button
              type="button"
              className={`rounded px-3 py-1 text-sm transition hover:bg-primary-dark hover:text-white ${
                view === 'interactive' ? 'bg-primary-light text-slate-900' : 'bg-slate-800'
              }`}
              onClick={() => setView('interactive')}
            >
              Interactive
            </button>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">
        {view === 'dashboard' && <DashboardView />}
        {view === 'instruments' && <InstrumentList />}
        {view === 'monitoring' && (
          <div className="grid gap-8 md:grid-cols-[1.5fr_1fr]">
            <MonitoringSetupList />
            <MonitoringSetupForm />
          </div>
        )}
        {view === 'interactive' && <InteractiveTerminal />}
      </main>
    </div>
  );
}
