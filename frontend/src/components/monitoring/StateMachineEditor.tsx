import { useState } from 'react';
import type { ReactElement } from 'react';
import type { State, Transition } from '../../types/monitoring';
import type { Instrument } from '../../types/instrument';
import { StateConfigurationPanel } from './StateConfigurationPanel';
import { StateMachineCanvas } from './StateMachineCanvas';

interface StateMachineEditorProps {
  states: State[];
  transitions: Transition[];
  initialStateID?: string;
  instruments: Instrument[];
  onChange: (states: State[], initialStateID?: string) => void;
  onTransitionsChange: (transitions: Transition[]) => void;
}

type ViewMode = 'list' | 'canvas';

export function StateMachineEditor({
  states,
  transitions,
  initialStateID,
  instruments,
  onChange,
  onTransitionsChange,
}: StateMachineEditorProps): ReactElement {
  const [viewMode, setViewMode] = useState<ViewMode>('canvas');
  const [nextStateId, setNextStateId] = useState(
    Math.max(...states.map((s) => parseInt(s.id.replace('state_', '')) || 0), 0) + 1
  );

  const handleAddState = (isEndState = false) => {
    const newState: State = {
      id: `state_${nextStateId}`,
      name: isEndState ? `End State ${nextStateId}` : `State ${nextStateId}`,
      isEndState,
      instrumentSettings: {},
    };

    setNextStateId(nextStateId + 1);
    
    // If this is the first state, make it the initial state
    const newInitialStateID = states.length === 0 ? newState.id : initialStateID;
    
    onChange([...states, newState], newInitialStateID);
  };

  const handleUpdateState = (stateId: string, updatedState: State) => {
    const newStates = states.map((s) => (s.id === stateId ? updatedState : s));
    onChange(newStates, initialStateID);
  };

  const handleDeleteState = (stateId: string) => {
    const newStates = states.filter((s) => s.id !== stateId);
    
    // If deleting the initial state, set a new one
    let newInitialStateID = initialStateID;
    if (initialStateID === stateId) {
      newInitialStateID = newStates.length > 0 ? newStates[0].id : undefined;
    }
    
    onChange(newStates, newInitialStateID);
  };

  const handleSetInitialState = (stateId: string) => {
    onChange(states, stateId);
  };

  const getStateById = (stateId: string | undefined): State | null => {
    if (!stateId) return null;
    return states.find((s) => s.id === stateId) || null;
  };

  const initialState = getStateById(initialStateID);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-primary-light">State Machine Configuration</h3>
          <p className="mt-1 text-sm text-slate-400">
            Define states and instrument settings for automated workflows.
          </p>
        </div>
        <div className="flex gap-2">
          {/* View mode toggle */}
          <div className="rounded border border-slate-700 bg-slate-800 p-1 flex">
            <button
              type="button"
              onClick={() => setViewMode('canvas')}
              className={`rounded px-3 py-1 text-xs font-medium transition ${
                viewMode === 'canvas'
                  ? 'bg-primary-light text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Canvas View
            </button>
            <button
              type="button"
              onClick={() => setViewMode('list')}
              className={`rounded px-3 py-1 text-xs font-medium transition ${
                viewMode === 'list'
                  ? 'bg-primary-light text-slate-900'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              List View
            </button>
          </div>
          {viewMode === 'list' && (
            <>
              <button
                type="button"
                onClick={() => handleAddState(false)}
                className="rounded bg-primary-light px-3 py-2 text-sm font-semibold text-slate-900 transition hover:bg-primary"
              >
                + Add State
              </button>
              <button
                type="button"
                onClick={() => handleAddState(true)}
                className="rounded bg-red-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-red-600"
              >
                + Add End State
              </button>
            </>
          )}
        </div>
      </div>

      {/* Canvas View */}
      {viewMode === 'canvas' && (
        <StateMachineCanvas
          states={states}
          transitions={transitions}
          initialStateID={initialStateID}
          instruments={instruments}
          onChange={onChange}
          onTransitionsChange={onTransitionsChange}
        />
      )}

      {/* List View */}
      {viewMode === 'list' && (
        <>
          {states.length === 0 && (
            <div className="rounded border border-slate-700 bg-slate-800/30 p-8 text-center">
              <p className="text-sm text-slate-400">
                No states defined yet. Click "Add State" to create your first state.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                States define specific configurations for your instruments. The state machine will
                transition between states based on rules you define.
              </p>
            </div>
          )}

          {initialState && (
            <div className="rounded border border-primary-light/30 bg-primary-dark/20 p-3">
              <div className="flex items-center gap-2">
                <span className="rounded bg-primary-light px-2 py-1 text-xs font-bold text-slate-900">
                  INITIAL STATE
                </span>
                <span className="text-sm font-medium text-slate-200">{initialState.name}</span>
                <span className="text-xs text-slate-400">
                  The workflow will start from this state
                </span>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {states.map((state) => (
              <div key={state.id} className="relative">
                {state.id === initialStateID && (
                  <div className="absolute -left-3 top-0 h-full w-1 bg-primary-light"></div>
                )}
                <StateConfigurationPanel
                  state={state}
                  instruments={instruments}
                  onChange={(updatedState) => handleUpdateState(state.id, updatedState)}
                  onDelete={() => handleDeleteState(state.id)}
                />
                {state.id !== initialStateID && (
                  <div className="mt-2 flex justify-end">
                    <button
                      type="button"
                      onClick={() => handleSetInitialState(state.id)}
                      className="rounded bg-slate-700 px-3 py-1 text-xs font-medium text-slate-200 hover:bg-slate-600"
                    >
                      Set as Initial State
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

          {states.length > 0 && (
            <div className="rounded border border-slate-700 bg-slate-800/30 p-4">
              <h4 className="mb-2 text-sm font-semibold text-slate-300">State Summary</h4>
              <div className="grid gap-2 md:grid-cols-3">
                <div className="rounded bg-slate-900/40 p-3">
                  <div className="text-xs text-slate-400">Total States</div>
                  <div className="text-lg font-semibold text-white">{states.length}</div>
                </div>
                <div className="rounded bg-slate-900/40 p-3">
                  <div className="text-xs text-slate-400">Transitions</div>
                  <div className="text-lg font-semibold text-white">{transitions.length}</div>
                </div>
                <div className="rounded bg-slate-900/40 p-3">
                  <div className="text-xs text-slate-400">End States</div>
                  <div className="text-lg font-semibold text-white">
                    {states.filter((s) => s.isEndState).length}
                  </div>
                </div>
              </div>
              {!initialStateID && states.length > 0 && (
                <div className="mt-3 rounded bg-yellow-900/20 border border-yellow-700/30 p-3">
                  <p className="text-xs text-yellow-400">
                    ⚠️ No initial state set. The workflow won't be able to start.
                  </p>
                </div>
              )}
              {states.filter((s) => !s.isEndState).length > 0 && states.filter((s) => s.isEndState).length === 0 && (
                <div className="mt-3 rounded bg-yellow-900/20 border border-yellow-700/30 p-3">
                  <p className="text-xs text-yellow-400">
                    ⚠️ No end states defined. Consider adding at least one end state to properly terminate workflows.
                  </p>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
