import type { ReactElement } from 'react';
import { validateStateMachine, type ValidationResult } from '../../utils/stateMachineValidation';
import type { State, Transition } from '../../types/monitoring';

interface ValidationPanelProps {
  states: State[];
  transitions: Transition[];
  initialStateID?: string;
}

export function ValidationPanel({ states, transitions, initialStateID }: ValidationPanelProps): ReactElement | null {
  const result: ValidationResult = validateStateMachine(states, transitions, initialStateID);

  // Don't show panel if everything is valid and no warnings
  if (result.valid && result.warnings.length === 0) {
    return null;
  }

  return (
    <div className="space-y-2">
      {/* Errors */}
      {result.errors.length > 0 && (
        <div className="rounded-lg border border-red-500 bg-red-900/40 p-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-red-200 mb-2">
                {result.errors.length} Error{result.errors.length > 1 ? 's' : ''} Found
              </h3>
              <ul className="space-y-1.5 text-sm text-red-200">
                {result.errors.map((error, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-red-400 font-semibold flex-shrink-0">{index + 1}.</span>
                    <span>{error.message}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-red-300/80">
                ⚠️ These errors must be fixed before the state machine can be started.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Warnings */}
      {result.warnings.length > 0 && (
        <div className="rounded-lg border border-yellow-500 bg-yellow-900/40 p-4">
          <div className="flex items-start gap-2">
            <svg className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div className="flex-1">
              <h3 className="text-sm font-semibold text-yellow-200 mb-2">
                {result.warnings.length} Warning{result.warnings.length > 1 ? 's' : ''}
              </h3>
              <ul className="space-y-1.5 text-sm text-yellow-200">
                {result.warnings.map((warning, index) => (
                  <li key={index} className="flex gap-2">
                    <span className="text-yellow-400 font-semibold flex-shrink-0">{index + 1}.</span>
                    <span>{warning.message}</span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-yellow-300/80">
                ℹ️ These are suggestions to improve your state machine. You can proceed, but review these warnings.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
