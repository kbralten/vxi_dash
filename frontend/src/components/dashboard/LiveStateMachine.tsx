import { useEffect, useState } from 'react';
import type { ReactElement } from 'react';
import ReactFlow, { 
  Background, 
  Controls, 
  MiniMap,
  Node,
  Edge,
  Position,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { getStateMachineStatus, type StateMachineStatus } from '../../services/monitoringService';
import type { State, Transition } from '../../types/monitoring';

interface LiveStateMachineProps {
  setupId: number;
  setupName: string;
  states: State[];
  transitions: Transition[];
  initialStateID?: string;
}

export function LiveStateMachine({ 
  setupId, 
  setupName,
  states, 
  transitions,
  initialStateID 
}: LiveStateMachineProps): ReactElement {
  const [smStatus, setSmStatus] = useState<StateMachineStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    let timer: number | undefined;

    const poll = async () => {
      try {
        const status = await getStateMachineStatus(setupId);
        if (mounted) {
          setSmStatus(status);
          setError(null);
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch status');
        }
      } finally {
        if (mounted) {
          timer = window.setTimeout(poll, 1000); // Poll every 1 second for live updates
        }
      }
    };

    poll();

    return () => {
      mounted = false;
      if (timer) window.clearTimeout(timer);
    };
  }, [setupId]);

  // Convert states to React Flow nodes
  const nodes: Node[] = states.map((state, index) => {
    const isActive = smStatus?.is_running && smStatus?.current_state_id === state.id;
    const isInitial = state.id === initialStateID;
    const isEnd = state.isEndState;

    return {
      id: state.id,
      type: 'default',
      position: { x: 100 + (index % 3) * 250, y: 100 + Math.floor(index / 3) * 150 },
      data: { 
        label: (
          <div className="text-center">
            <div className="font-semibold text-sm">{state.name}</div>
            {isInitial && (
              <div className="text-xs text-green-400 mt-1">Initial</div>
            )}
            {isEnd && (
              <div className="text-xs text-red-400 mt-1">End</div>
            )}
            {isActive && smStatus?.time_in_current_state !== null && (
              <div className="text-xs text-primary-light mt-1 font-medium">
                {smStatus.time_in_current_state.toFixed(1)}s
              </div>
            )}
          </div>
        )
      },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      style: {
        background: isActive ? '#06b6d4' : isEnd ? '#ef4444' : isInitial ? '#10b981' : '#334155',
        color: isActive ? '#0f172a' : '#fff',
        border: isActive ? '3px solid #0891b2' : '2px solid #475569',
        borderRadius: '8px',
        padding: '12px 16px',
        minWidth: '140px',
        boxShadow: isActive ? '0 0 20px rgba(6, 182, 212, 0.6), 0 0 40px rgba(6, 182, 212, 0.3)' : 'none',
        transition: 'all 0.3s ease',
      },
    };
  });

  // Convert transitions to React Flow edges
  const edges: Edge[] = transitions.map((transition) => {
    const isActiveTransition = smStatus?.is_running && smStatus?.current_state_id === transition.sourceStateID;

    return {
      id: transition.id,
      source: transition.sourceStateID,
      target: transition.targetStateID,
      type: 'smoothstep',
      animated: isActiveTransition,
      style: {
        stroke: isActiveTransition ? '#06b6d4' : '#64748b',
        strokeWidth: isActiveTransition ? 3 : 2,
      },
      label: transition.rules && transition.rules.length > 0 
        ? `${transition.rules.length} rule${transition.rules.length > 1 ? 's' : ''}`
        : undefined,
      labelStyle: {
        fill: '#94a3b8',
        fontSize: 10,
      },
      labelBgStyle: {
        fill: '#1e293b',
        fillOpacity: 0.8,
      },
    };
  });

  if (error) {
    return (
      <div className="rounded border border-red-500 bg-red-900/40 p-4 text-red-200 text-sm">
        Failed to load state machine status: {error}
      </div>
    );
  }

  if (!states || states.length === 0) {
    return (
      <div className="rounded border border-slate-700 bg-slate-800/50 p-4 text-slate-400 text-sm text-center">
        No state machine defined for this setup
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 overflow-hidden">
      {/* Header with status */}
      <div className="border-b border-slate-700 bg-slate-800 px-4 py-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-100">{setupName}</h3>
            <div className="text-xs text-slate-400 mt-1">Live State Machine Visualization</div>
          </div>
          <div className="flex items-center gap-3">
            {smStatus?.is_running ? (
              <>
                <div className="flex items-center gap-2">
                  <span className="inline-block w-2 h-2 bg-green-400 rounded-full animate-pulse"></span>
                  <span className="text-sm text-green-400 font-medium">Running</span>
                </div>
                {smStatus.current_state_id && (
                  <div className="text-sm text-slate-300">
                    <span className="text-slate-400">Current:</span>{' '}
                    <span className="text-primary-light font-semibold">
                      {states.find(s => s.id === smStatus.current_state_id)?.name || smStatus.current_state_id}
                    </span>
                  </div>
                )}
                {smStatus.total_session_time !== null && (
                  <div className="text-xs text-slate-400">
                    Session: {smStatus.total_session_time.toFixed(1)}s
                  </div>
                )}
              </>
            ) : (
              <span className="text-sm text-slate-400">Not Running</span>
            )}
          </div>
        </div>
      </div>

      {/* React Flow Canvas */}
      <div style={{ height: '400px', width: '100%' }}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          fitView
          attributionPosition="bottom-left"
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnScroll={false}
          zoomOnScroll={false}
          panOnDrag={true}
          minZoom={0.5}
          maxZoom={1.5}
        >
          <Background color="#475569" gap={16} />
          <Controls className="bg-slate-800 border-slate-700" />
          <MiniMap 
            nodeColor={(node) => {
              if (smStatus?.is_running && smStatus?.current_state_id === node.id) {
                return '#06b6d4';
              }
              const state = states.find(s => s.id === node.id);
              if (state?.isEndState) return '#ef4444';
              if (state?.id === initialStateID) return '#10b981';
              return '#334155';
            }}
            maskColor="rgba(15, 23, 42, 0.8)"
            className="bg-slate-800 border-slate-700"
          />
        </ReactFlow>
      </div>

      {/* Legend */}
      <div className="border-t border-slate-700 bg-slate-800 px-4 py-2 flex items-center gap-4 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-cyan-500 border-2 border-cyan-600"></div>
          <span className="text-slate-300">Active State</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-green-500 border-2 border-slate-600"></div>
          <span className="text-slate-300">Initial State</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-red-500 border-2 border-slate-600"></div>
          <span className="text-slate-300">End State</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded bg-slate-700 border-2 border-slate-600"></div>
          <span className="text-slate-300">Regular State</span>
        </div>
      </div>
    </div>
  );
}
