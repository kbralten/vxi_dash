import { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import { fetchLiveData } from '../../services/dataService';
import type { Reading } from '../../services/dataService';
import { fetchMonitoringSetups } from '../../services/monitoringService';
import type { MonitoringSetup } from '../../types/monitoring';
import { LiveChart } from './LiveChart';
import { ReadingsTable } from './ReadingsTable';
import { LiveStateMachine } from './LiveStateMachine';

export function LiveDashboard(): ReactElement {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [selectedSetup, setSelectedSetup] = useState<number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5000); // 5 seconds
  const [loading, setLoading] = useState(false);
  const [monitoringSetups, setMonitoringSetups] = useState<MonitoringSetup[]>([]);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await fetchLiveData(100);
      setReadings(data);
    } catch (error) {
      console.error('Failed to load live data:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadMonitoringSetups = async () => {
    try {
      const setups = await fetchMonitoringSetups();
      setMonitoringSetups(setups);
    } catch (error) {
      console.error('Failed to load monitoring setups:', error);
    }
  };

  useEffect(() => {
    loadData();
    loadMonitoringSetups();
    
    if (autoRefresh) {
      const interval = setInterval(loadData, refreshInterval);
      return () => clearInterval(interval);
    }
  }, [autoRefresh, refreshInterval]);

  // Get unique setups from readings
  const setups = Array.from(
    new Map(
      readings.map(r => [r.setup_id, { id: r.setup_id, name: r.setup_name }])
    ).values()
  );

  // Filter readings by selected setup
  const filteredReadings = selectedSetup
    ? readings.filter(r => r.setup_id === selectedSetup)
    : readings;

  // Get state machine setups (only show multi-state machines)
  const stateMachineSetups = monitoringSetups.filter(
    setup => setup.states && setup.states.length > 1
  );

  // Get the selected setup details if it has a state machine
  const selectedSetupDetails = selectedSetup 
    ? monitoringSetups.find(s => s.id === selectedSetup)
    : null;
  const showStateMachine = selectedSetupDetails && 
    selectedSetupDetails.states && 
    selectedSetupDetails.states.length > 1; // Only show for multi-state machines

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-100">Live Dashboard</h1>
        
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
              className="rounded border-slate-700 bg-slate-800 text-primary-light focus:ring-primary-light"
            />
            Auto-refresh
          </label>
          
          <select
            value={refreshInterval}
            onChange={(e) => setRefreshInterval(Number(e.target.value))}
            disabled={!autoRefresh}
            className="rounded border border-slate-700 bg-slate-800 px-3 py-1 text-sm text-slate-100 disabled:opacity-50"
          >
            <option value={1000}>1s</option>
            <option value={2000}>2s</option>
            <option value={5000}>5s</option>
            <option value={10000}>10s</option>
            <option value={30000}>30s</option>
          </select>

          <button
            onClick={loadData}
            disabled={loading}
            className="rounded bg-primary-light px-4 py-2 text-sm font-medium text-slate-900 hover:bg-primary-dark hover:text-white disabled:opacity-50"
          >
            {loading ? 'Loading...' : 'Refresh Now'}
          </button>
        </div>
      </div>

      {/* Setup Filter */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <label className="mb-2 block text-sm font-medium text-slate-300">
          Filter by Setup
        </label>
        <div className="flex gap-2">
          <button
            onClick={() => setSelectedSetup(null)}
            className={`rounded px-3 py-1 text-sm ${
              selectedSetup === null
                ? 'bg-primary-light text-slate-900'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            All Setups
          </button>
          {setups.map(setup => (
            <button
              key={setup.id}
              onClick={() => setSelectedSetup(setup.id)}
              className={`rounded px-3 py-1 text-sm ${
                selectedSetup === setup.id
                  ? 'bg-primary-light text-slate-900'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              {setup.name}
            </button>
          ))}
        </div>
      </div>

      {/* Live State Machine Visualization */}
      {showStateMachine && selectedSetupDetails && (
        <LiveStateMachine
          setupId={selectedSetupDetails.id}
          setupName={selectedSetupDetails.name}
          states={selectedSetupDetails.states!}
          transitions={selectedSetupDetails.transitions || []}
          initialStateID={selectedSetupDetails.initialStateID}
        />
      )}

      {/* State Machine Setups List (when no specific setup selected) */}
      {!selectedSetup && stateMachineSetups.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-slate-100">State Machine Setups</h2>
          {stateMachineSetups.map(setup => (
            <LiveStateMachine
              key={setup.id}
              setupId={setup.id}
              setupName={setup.name}
              states={setup.states!}
              transitions={setup.transitions || []}
              initialStateID={setup.initialStateID}
            />
          ))}
        </div>
      )}

      {/* Live Charts */}
      {filteredReadings.length > 0 && (
        <LiveChart readings={filteredReadings} />
      )}

      {/* Readings Table */}
      <ReadingsTable readings={filteredReadings.slice(-20)} />

      {/* Empty State */}
      {filteredReadings.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 p-12 text-center">
          <p className="text-slate-400">No data available yet.</p>
          <p className="mt-2 text-sm text-slate-500">
            Start monitoring a setup to begin collecting data.
          </p>
        </div>
      )}
    </div>
  );
}
