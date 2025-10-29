/**
 * State machine validation utilities
 * Provides pre-start validation and error detection for state machines
 */

import type { State, Transition } from '../types/monitoring';

export interface ValidationIssue {
  severity: 'error' | 'warning';
  message: string;
  stateId?: string;
  stateName?: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

/**
 * Comprehensive validation of a state machine configuration
 */
export function validateStateMachine(
  states: State[],
  transitions: Transition[],
  initialStateID?: string
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];

  // Check 1: Must have at least one state
  if (!states || states.length === 0) {
    errors.push({
      severity: 'error',
      message: 'State machine must have at least one state',
    });
    return { valid: false, errors, warnings };
  }

  // Check 2: Must have an initial state
  if (!initialStateID) {
    errors.push({
      severity: 'error',
      message: 'No initial state set. Click "Set as Initial" on a state to designate the starting state.',
    });
  } else {
    // Check 3: Initial state must exist
    const initialState = states.find(s => s.id === initialStateID);
    if (!initialState) {
      errors.push({
        severity: 'error',
        message: `Initial state ID "${initialStateID}" does not exist in state list`,
        stateId: initialStateID,
      });
    } else if (initialState.isEndState) {
      // Check 4: Initial state should not be an end state
      errors.push({
        severity: 'error',
        message: `State "${initialState.name}" is marked as both Initial and End state. This would cause immediate shutdown.`,
        stateId: initialState.id,
        stateName: initialState.name,
      });
    }
  }

  // Check 5: Validate state IDs are unique
  const stateIds = states.map(s => s.id);
  const duplicateIds = stateIds.filter((id, index) => stateIds.indexOf(id) !== index);
  if (duplicateIds.length > 0) {
    errors.push({
      severity: 'error',
      message: `Duplicate state IDs found: ${duplicateIds.join(', ')}`,
    });
  }

  // Check 6: Validate state names are not empty
  states.forEach(state => {
    if (!state.name || state.name.trim() === '') {
      warnings.push({
        severity: 'warning',
        message: `State "${state.id}" has no name`,
        stateId: state.id,
      });
    }
  });

  // Check 7: Find unreachable states (states with no incoming transitions and not initial)
  const unreachableStates = findUnreachableStates(states, transitions, initialStateID);
  unreachableStates.forEach(state => {
    warnings.push({
      severity: 'warning',
      message: `State "${state.name}" is unreachable (not initial and no incoming transitions). It will never execute.`,
      stateId: state.id,
      stateName: state.name,
    });
  });

  // Check 8: Find dead-end states (non-end states with no outgoing transitions)
  const deadEndStates = findDeadEndStates(states, transitions);
  deadEndStates.forEach(state => {
    warnings.push({
      severity: 'warning',
      message: `State "${state.name}" has no outgoing transitions and is not marked as End State. Workflow will get stuck here.`,
      stateId: state.id,
      stateName: state.name,
    });
  });

  // Check 9: Validate transition rules
  transitions.forEach((transition, index) => {
    // Check source and target exist
    const sourceExists = states.some(s => s.id === transition.sourceStateID);
    const targetExists = states.some(s => s.id === transition.targetStateID);

    if (!sourceExists) {
      errors.push({
        severity: 'error',
        message: `Transition ${index + 1} references non-existent source state ID: ${transition.sourceStateID}`,
      });
    }

    if (!targetExists) {
      errors.push({
        severity: 'error',
        message: `Transition ${index + 1} references non-existent target state ID: ${transition.targetStateID}`,
      });
    }

    // Check for empty rules
    if (!transition.rules || transition.rules.length === 0) {
      warnings.push({
        severity: 'warning',
        message: `Transition from "${getStateName(states, transition.sourceStateID)}" to "${getStateName(states, transition.targetStateID)}" has no rules and will never trigger`,
      });
    } else {
      // Validate individual rules
      transition.rules.forEach((rule, ruleIndex) => {
        if (rule.type === 'sensor') {
          if (!rule.signalName) {
            errors.push({
              severity: 'error',
              message: `Transition rule ${ruleIndex + 1} from "${getStateName(states, transition.sourceStateID)}" is missing signal name`,
            });
          }
          if (!rule.operator) {
            errors.push({
              severity: 'error',
              message: `Transition rule ${ruleIndex + 1} from "${getStateName(states, transition.sourceStateID)}" is missing operator`,
            });
          }
          if (rule.value === undefined || rule.value === null) {
            errors.push({
              severity: 'error',
              message: `Transition rule ${ruleIndex + 1} from "${getStateName(states, transition.sourceStateID)}" is missing threshold value`,
            });
          }
        } else if (rule.type === 'timeInState' || rule.type === 'totalTime') {
          if (rule.seconds === undefined || rule.seconds === null || rule.seconds < 0) {
            errors.push({
              severity: 'error',
              message: `Transition rule ${ruleIndex + 1} from "${getStateName(states, transition.sourceStateID)}" has invalid time value`,
            });
          }
        }
      });
    }
  });

  // Check 10: Warn if no end states exist
  const endStates = states.filter(s => s.isEndState);
  if (endStates.length === 0) {
    warnings.push({
      severity: 'warning',
      message: 'No end states defined. State machine will run indefinitely until manually stopped.',
    });
  }

  // Check 11: Validate instrument settings
  states.forEach(state => {
    if (!state.instrumentSettings || Object.keys(state.instrumentSettings).length === 0) {
      warnings.push({
        severity: 'warning',
        message: `State "${state.name}" has no instrument settings configured. No actions will occur in this state.`,
        stateId: state.id,
        stateName: state.name,
      });
    }
  });

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Find states that cannot be reached from the initial state
 */
function findUnreachableStates(
  states: State[],
  transitions: Transition[],
  initialStateID?: string
): State[] {
  if (!initialStateID) return states;

  const reachable = new Set<string>();
  reachable.add(initialStateID);

  // Iteratively find all reachable states
  let changed = true;
  while (changed) {
    changed = false;
    transitions.forEach(transition => {
      if (reachable.has(transition.sourceStateID) && !reachable.has(transition.targetStateID)) {
        reachable.add(transition.targetStateID);
        changed = true;
      }
    });
  }

  return states.filter(state => !reachable.has(state.id));
}

/**
 * Find non-end states with no outgoing transitions (dead ends)
 */
function findDeadEndStates(states: State[], transitions: Transition[]): State[] {
  const statesWithOutgoing = new Set(transitions.map(t => t.sourceStateID));
  return states.filter(state => !state.isEndState && !statesWithOutgoing.has(state.id));
}

/**
 * Helper to get state name by ID
 */
function getStateName(states: State[], stateId: string): string {
  const state = states.find(s => s.id === stateId);
  return state?.name || stateId;
}

/**
 * Format validation issues for display
 */
export function formatValidationMessage(result: ValidationResult): string {
  const messages: string[] = [];

  if (result.errors.length > 0) {
    messages.push('ERRORS:');
    result.errors.forEach((error, index) => {
      messages.push(`${index + 1}. ${error.message}`);
    });
  }

  if (result.warnings.length > 0) {
    if (messages.length > 0) messages.push('');
    messages.push('WARNINGS:');
    result.warnings.forEach((warning, index) => {
      messages.push(`${index + 1}. ${warning.message}`);
    });
  }

  return messages.join('\n');
}
