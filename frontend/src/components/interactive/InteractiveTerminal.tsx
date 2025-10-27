import { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import { getInstruments } from '../../services/instrumentService';
import { ModeControl } from './ModeControl';
import { CommandTerminal } from './CommandTerminal';

interface Instrument {
  id: number;
  name: string;
  address: string;
  description: string;
  is_active: boolean;
}

export function InteractiveTerminal(): ReactElement {
  const [instruments, setInstruments] = useState<Instrument[]>([]);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadInstruments();
  }, []);

  const loadInstruments = async () => {
    try {
      setLoading(true);
      const data = await getInstruments();
      setInstruments(data.filter((inst: Instrument) => inst.is_active));
      if (data.length > 0 && data[0].is_active) {
        setSelectedInstrumentId(data[0].id);
      }
    } catch (error) {
      console.error('Failed to load instruments:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedInstrument = instruments.find(inst => inst.id === selectedInstrumentId);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-slate-400">Loading instruments...</div>
      </div>
    );
  }

  if (instruments.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
        <p className="text-slate-400">No active instruments available.</p>
        <p className="mt-2 text-sm text-slate-500">
          Please create and activate an instrument first.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Instrument Selector */}
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-6">
        <label className="mb-2 block text-sm font-medium text-slate-300">
          Select Instrument
        </label>
        <select
          value={selectedInstrumentId || ''}
          onChange={(e) => setSelectedInstrumentId(Number(e.target.value))}
          className="w-full rounded border border-slate-700 bg-slate-800 px-3 py-2 text-slate-100 focus:border-primary-light focus:outline-none focus:ring-1 focus:ring-primary-light"
        >
          {instruments.map((instrument) => (
            <option key={instrument.id} value={instrument.id}>
              {instrument.name} ({instrument.address})
            </option>
          ))}
        </select>
      </div>

      {selectedInstrument && (
        <>
          {/* SCPI Command Terminal */}
          <CommandTerminal instrument={selectedInstrument} />

          {/* Mode Control Panel */}
          <ModeControl instrument={selectedInstrument} />
        </>
      )}
    </div>
  );
}
