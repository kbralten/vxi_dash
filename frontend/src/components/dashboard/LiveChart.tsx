import { useMemo } from 'react';
import type { ReactElement } from 'react';
import type { Reading } from '../../services/dataService';

interface LiveChartProps {
  readings: Reading[];
}

export function LiveChart({ readings }: LiveChartProps): ReactElement {
  // Group readings by signal name
  const signalData = useMemo(() => {
    const signals: Map<string, { timestamps: string[]; values: number[] }> = new Map();
    
    readings.forEach(reading => {
      if (reading.readings) {
        Object.entries(reading.readings).forEach(([signalName, data]) => {
          if (data.value !== null && data.value !== undefined) {
            if (!signals.has(signalName)) {
              signals.set(signalName, { timestamps: [], values: [] });
            }
            const signal = signals.get(signalName)!;
            signal.timestamps.push(reading.timestamp);
            signal.values.push(data.value);
          }
        });
      }
    });
    
    return signals;
  }, [readings]);

  if (signalData.size === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-8 text-center">
        <p className="text-slate-400">No signal data to display</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-slate-100">Live Signal Trends</h2>
      
      <div className="grid gap-4 md:grid-cols-2">
        {Array.from(signalData.entries()).map(([signalName, data]) => (
          <SignalChart
            key={signalName}
            signalName={signalName}
            values={data.values}
            unit={readings[readings.length - 1]?.readings?.[signalName]?.unit || ''}
          />
        ))}
      </div>
    </div>
  );
}

interface SignalChartProps {
  signalName: string;
  values: number[];
  unit: string;
}

function SignalChart({ signalName, values, unit }: SignalChartProps): ReactElement {
  if (!values || values.length === 0) {
    return (
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <div className="mb-2 flex items-baseline justify-between">
          <h3 className="font-medium text-slate-100">{signalName}</h3>
          <div className="text-xs text-slate-400">{unit}</div>
        </div>
        <div className="text-sm text-slate-400">No data</div>
      </div>
    );
  }
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const range = maxValue - minValue || 1;
  const latestValue = values[values.length - 1];
  
  // Calculate SVG path for sparkline
  const width = 300;
  const height = 60;
  const points = values.slice(-50).map((value, index, array) => {
    const x = (index / (array.length - 1)) * width;
    const y = height - ((value - minValue) / range) * height;
    return `${x},${y}`;
  }).join(' L ');
  
  const path = points ? `M ${points}` : '';

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
      <div className="mb-2 flex items-baseline justify-between">
        <h3 className="font-medium text-slate-100">{signalName}</h3>
        <div className="text-right">
          <div className="text-2xl font-bold text-primary-light">
            {latestValue.toFixed(2)}
          </div>
          <div className="text-xs text-slate-400">{unit}</div>
        </div>
      </div>
      
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full"
        style={{ height: '60px' }}
      >
        {/* Background grid */}
        <line x1="0" y1="30" x2={width} y2="30" stroke="#334155" strokeWidth="0.5" strokeDasharray="2,2" />
        
        {/* Data line */}
        <path
          d={path}
          fill="none"
          stroke="#10b981"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        
        {/* Last point indicator */}
        {points && (
          <circle
            cx={width}
            cy={height - ((latestValue - minValue) / range) * height}
            r="3"
            fill="#10b981"
          />
        )}
      </svg>
      
      <div className="mt-2 flex justify-between text-xs text-slate-500">
        <span>Min: {minValue.toFixed(2)}</span>
        <span>Max: {maxValue.toFixed(2)}</span>
      </div>
    </div>
  );
}
