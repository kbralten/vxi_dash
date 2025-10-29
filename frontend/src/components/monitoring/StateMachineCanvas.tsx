import { useCallback, useMemo, useState } from 'react';
import type { ReactElement } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  addEdge,
  Connection,
  ConnectionMode,
  Panel,
} from 'reactflow';
import 'reactflow/dist/style.css';
import type { State, Transition } from '../../types/monitoring';
import type { Instrument } from '../../types/instrument';
import StateNode from './StateNode';
import { StateConfigurationPanel } from './StateConfigurationPanel';
import { TransitionRuleModal } from './TransitionRuleModal';

interface StateMachineCanvasProps {
  states: State[];
  transitions: Transition[];
  initialStateID?: string;
  instruments: Instrument[];
  onChange: (states: State[], initialStateID?: string) => void;
  onTransitionsChange: (transitions: Transition[]) => void;
}

const nodeTypes = {
  stateNode: StateNode,
};

export function StateMachineCanvas({
  states,
  transitions,
  initialStateID,
  instruments,
  onChange,
  onTransitionsChange,
}: StateMachineCanvasProps): ReactElement {
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [selectedTransitionId, setSelectedTransitionId] = useState<string | null>(null);

  // Define all callback handlers FIRST before using them in useMemo
  const handleAddState = useCallback(
    (isEndState = false) => {
      const newStateId = `state_${Date.now()}`;
      const newState: State = {
        id: newStateId,
        name: isEndState ? `End State ${states.length + 1}` : `State ${states.length + 1}`,
        isEndState,
        instrumentSettings: {},
      };

      const newInitialStateID = states.length === 0 ? newState.id : initialStateID;
      onChange([...states, newState], newInitialStateID);
    },
    [states, initialStateID, onChange]
  );

  const handleDeleteState = useCallback(
    (stateId: string) => {
      const newStates = states.filter((s) => s.id !== stateId);
      let newInitialStateID = initialStateID;

      if (initialStateID === stateId) {
        newInitialStateID = newStates.length > 0 ? newStates[0].id : undefined;
      }

      if (selectedStateId === stateId) {
        setSelectedStateId(null);
        setShowSidebar(false);
      }

      // Remove transitions connected to this state
      const newTransitions = transitions.filter(
        (t) => t.sourceStateID !== stateId && t.targetStateID !== stateId
      );
      onTransitionsChange(newTransitions);

      onChange(newStates, newInitialStateID);
    },
    [states, initialStateID, selectedStateId, transitions, onChange, onTransitionsChange]
  );

  const handleSetInitialState = useCallback(
    (stateId: string) => {
      onChange(states, stateId);
    },
    [states, onChange]
  );

  const handleUpdateState = useCallback(
    (stateId: string, updatedState: State) => {
      const newStates = states.map((s) => (s.id === stateId ? updatedState : s));
      onChange(newStates, initialStateID);
    },
    [states, initialStateID, onChange]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;

      // Create a new transition
      const newTransition: Transition = {
        id: `transition_${Date.now()}`,
        sourceStateID: connection.source,
        targetStateID: connection.target,
        rules: [], // Start with no rules; user can add them later
      };

      onTransitionsChange([...transitions, newTransition]);
    },
    [transitions, onTransitionsChange]
  );

  const handleEdgeDelete = useCallback(
    (edgesToDelete: Edge[]) => {
      const edgeIds = edgesToDelete.map((e) => e.id);
      const newTransitions = transitions.filter((t) => !edgeIds.includes(t.id));
      onTransitionsChange(newTransitions);
    },
    [transitions, onTransitionsChange]
  );

  const handleEdgeClick = useCallback(
    (_event: React.MouseEvent, edge: Edge) => {
      setSelectedTransitionId(edge.id);
    },
    []
  );

  const handleUpdateTransition = useCallback(
    (updatedTransition: Transition) => {
      const newTransitions = transitions.map((t) =>
        t.id === updatedTransition.id ? updatedTransition : t
      );
      onTransitionsChange(newTransitions);
    },
    [transitions, onTransitionsChange]
  );

  // Extract available signal names from instrument configurations
  const availableSignals = useMemo(() => {
    const signals = new Set<string>();
    instruments.forEach((instrument) => {
      if (instrument.description) {
        try {
          const config = JSON.parse(instrument.description);
          if (config.signals && Array.isArray(config.signals)) {
            config.signals.forEach((signal: { name?: string }) => {
              if (signal.name) signals.add(signal.name);
            });
          }
        } catch (e) {
          // Ignore parse errors
        }
      }
    });
    return Array.from(signals);
  }, [instruments]);

  // Convert states to React Flow nodes (now that all callbacks are defined)
  const initialNodes: Node[] = useMemo(() => {
    return states.map((state, index) => ({
      id: state.id,
      type: 'stateNode',
      position: { x: 250 * (index % 3), y: 200 * Math.floor(index / 3) },
      data: {
        state,
        isInitial: state.id === initialStateID,
        onEdit: (stateId: string) => {
          setSelectedStateId(stateId);
          setShowSidebar(true);
        },
        onDelete: handleDeleteState,
        onSetInitial: handleSetInitialState,
      },
    }));
  }, [states, initialStateID, handleDeleteState, handleSetInitialState]);

  // Convert transitions to React Flow edges
  const initialEdges: Edge[] = useMemo(() => {
    return transitions.map((transition) => ({
      id: transition.id,
      source: transition.sourceStateID,
      target: transition.targetStateID,
      type: 'smoothstep',
      animated: true,
      label: transition.rules.length > 0 ? `${transition.rules.length} rule${transition.rules.length > 1 ? 's' : ''}` : 'click to add rules',
      style: { stroke: '#22d3ee', strokeWidth: 2, cursor: 'pointer' },
      labelStyle: { fill: '#22d3ee', fontSize: 10, fontWeight: 600 },
      labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 },
    }));
  }, [transitions]);

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>(initialEdges);

  // Update nodes when states change
  useMemo(() => {
    setNodes(
      states.map((state) => {
        const existingNode = nodes.find((n) => n.id === state.id);
        return {
          id: state.id,
          type: 'stateNode',
          position: existingNode?.position || { x: 250 * (states.indexOf(state) % 3), y: 200 * Math.floor(states.indexOf(state) / 3) },
          data: {
            state,
            isInitial: state.id === initialStateID,
            onEdit: (stateId: string) => {
              setSelectedStateId(stateId);
              setShowSidebar(true);
            },
            onDelete: handleDeleteState,
            onSetInitial: handleSetInitialState,
          },
        };
      })
    );
  }, [states, initialStateID, handleDeleteState, handleSetInitialState, setNodes]);

  // Update edges when transitions change
  useMemo(() => {
    setEdges(
      transitions.map((transition) => ({
        id: transition.id,
        source: transition.sourceStateID,
        target: transition.targetStateID,
        type: 'smoothstep',
        animated: true,
        label: transition.rules.length > 0 ? `${transition.rules.length} rule${transition.rules.length > 1 ? 's' : ''}` : 'click to add rules',
        style: { stroke: '#22d3ee', strokeWidth: 2, cursor: 'pointer' },
        labelStyle: { fill: '#22d3ee', fontSize: 10, fontWeight: 600 },
        labelBgStyle: { fill: '#1e293b', fillOpacity: 0.9 },
      }))
    );
  }, [transitions, setEdges]);

  const selectedState = selectedStateId ? states.find((s) => s.id === selectedStateId) : null;

  return (
    <div className="flex h-[600px] gap-4">
      {/* Canvas */}
      <div className={`flex-1 rounded-lg border border-slate-700 bg-slate-900 overflow-hidden ${showSidebar ? 'w-2/3' : 'w-full'}`}>
        <ReactFlow
          nodes={nodes}
          edges={edges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onEdgesDelete={handleEdgeDelete}
          onEdgeClick={handleEdgeClick}
          nodeTypes={nodeTypes}
          connectionMode={ConnectionMode.Loose}
          fitView
          className="bg-slate-900"
        >
          <Background variant={BackgroundVariant.Dots} gap={16} size={1} color="#475569" />
          <Controls className="bg-slate-800 border border-slate-700 rounded" />
          
          <Panel position="top-left" className="space-x-2">
            <button
              type="button"
              onClick={() => handleAddState(false)}
              className="rounded bg-primary-light px-3 py-2 text-sm font-semibold text-slate-900 shadow-lg transition hover:bg-primary"
            >
              + Add State
            </button>
            <button
              type="button"
              onClick={() => handleAddState(true)}
              className="rounded bg-red-700 px-3 py-2 text-sm font-semibold text-white shadow-lg transition hover:bg-red-600"
            >
              + Add End State
            </button>
          </Panel>

          <Panel position="top-right">
            <div className="rounded bg-slate-800 border border-slate-700 px-3 py-2 text-xs text-slate-300 shadow-lg">
              <div className="font-semibold mb-1">States: {states.length}</div>
              <div className="text-slate-400">Transitions: {transitions.length}</div>
              <div className="text-slate-400">End States: {states.filter(s => s.isEndState).length}</div>
            </div>
          </Panel>

          {states.length === 0 && (
            <Panel position="top-center">
              <div className="rounded-lg border border-slate-700 bg-slate-800/90 p-8 text-center shadow-xl mt-20">
                <p className="text-sm font-medium text-slate-200 mb-2">
                  No states defined yet
                </p>
                <p className="text-xs text-slate-400 mb-4">
                  Click "Add State" to create your first state
                </p>
              </div>
            </Panel>
          )}
        </ReactFlow>
      </div>

      {/* Sidebar for editing */}
      {showSidebar && selectedState && (
        <div className="w-1/3 min-w-[300px] max-w-[400px] rounded-lg border border-slate-700 bg-slate-800 p-4 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-primary-light">Edit State</h3>
            <button
              type="button"
              onClick={() => {
                setShowSidebar(false);
                setSelectedStateId(null);
              }}
              className="text-slate-400 hover:text-slate-200 text-xl font-bold"
            >
              ×
            </button>
          </div>
          <StateConfigurationPanel
            state={selectedState}
            instruments={instruments}
            onChange={(updatedState) => handleUpdateState(selectedState.id, updatedState)}
            onDelete={() => handleDeleteState(selectedState.id)}
          />
        </div>
      )}

      {/* Transition Rule Modal */}
      {selectedTransitionId && (() => {
        const transition = transitions.find((t) => t.id === selectedTransitionId);
        const sourceState = transition ? states.find((s) => s.id === transition.sourceStateID) : null;
        const targetState = transition ? states.find((s) => s.id === transition.targetStateID) : null;
        
        return transition && sourceState && targetState ? (
          <TransitionRuleModal
            transition={transition}
            sourceStateName={sourceState.name}
            targetStateName={targetState.name}
            availableSignals={availableSignals}
            onSave={handleUpdateTransition}
            onClose={() => setSelectedTransitionId(null)}
          />
        ) : null;
      })()}
    </div>
  );
}
