import { memo } from 'react';
import { Handle, Position, NodeProps } from 'reactflow';
import type { State } from '../../types/monitoring';

interface StateNodeData {
  state: State;
  isInitial: boolean;
  onEdit: (stateId: string) => void;
  onDelete: (stateId: string) => void;
  onSetInitial: (stateId: string) => void;
}

function StateNode({ data, selected }: NodeProps<StateNodeData>) {
  const { state, isInitial, onEdit, onDelete, onSetInitial } = data;

  return (
    <div
      className={`rounded-lg border-2 bg-slate-800 px-4 py-3 shadow-lg transition-all ${
        selected
          ? 'border-primary-light shadow-primary-light/50'
          : isInitial
          ? 'border-primary-light/70'
          : state.isEndState
          ? 'border-red-700'
          : 'border-slate-600'
      }`}
      style={{ minWidth: '180px' }}
    >
      <Handle
        type="target"
        position={Position.Top}
        className="!bg-primary-light !border-2 !border-slate-900 !w-3 !h-3"
      />

      <div className="space-y-2">
        {/* State header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isInitial && (
              <span className="rounded bg-primary-light px-1.5 py-0.5 text-[10px] font-bold text-slate-900 whitespace-nowrap">
                START
              </span>
            )}
            {state.isEndState && (
              <span className="rounded bg-red-700 px-1.5 py-0.5 text-[10px] font-bold text-white whitespace-nowrap">
                END
              </span>
            )}
          </div>
        </div>

        {/* State name */}
        <div className="font-semibold text-white text-sm truncate" title={state.name}>
          {state.name || 'Unnamed State'}
        </div>

        {/* Instrument count */}
        <div className="text-xs text-slate-400">
          {Object.keys(state.instrumentSettings).length} instrument(s) configured
        </div>

        {/* Actions */}
        <div className="flex gap-1 pt-1">
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onEdit(state.id);
            }}
            className="flex-1 rounded bg-slate-700 px-2 py-1 text-[10px] font-medium text-slate-200 hover:bg-slate-600 transition"
          >
            Edit
          </button>
          {!isInitial && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onSetInitial(state.id);
              }}
              className="flex-1 rounded bg-primary-dark px-2 py-1 text-[10px] font-medium text-primary-light hover:bg-primary-dark/70 transition whitespace-nowrap"
            >
              Set Initial
            </button>
          )}
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete(state.id);
            }}
            className="rounded bg-red-900/40 px-2 py-1 text-[10px] font-medium text-red-300 hover:bg-red-900/60 transition"
          >
            Delete
          </button>
        </div>
      </div>

      <Handle
        type="source"
        position={Position.Bottom}
        className="!bg-primary-light !border-2 !border-slate-900 !w-3 !h-3"
      />
    </div>
  );
}

export default memo(StateNode);
