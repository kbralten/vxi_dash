import { useState, useEffect } from 'react';
import type { ReactElement } from 'react';
import type { Rule, Transition } from '../../types/monitoring';

interface TransitionRuleModalProps {
  transition: Transition;
  sourceStateName: string;
  targetStateName: string;
  availableSignals: string[];
  onSave: (updatedTransition: Transition) => void;
  onClose: () => void;
}

const RULE_TYPES = [
  { value: 'sensor', label: 'Sensor Value' },
  { value: 'timeInState', label: 'Time in State' },
  { value: 'totalTime', label: 'Total Time' },
] as const;

const OPERATORS = [
  { value: '>', label: '>' },
  { value: '>=', label: '≥' },
  { value: '<', label: '<' },
  { value: '<=', label: '≤' },
  { value: '==', label: '=' },
  { value: '!=', label: '≠' },
] as const;

export function TransitionRuleModal({
  transition,
  sourceStateName,
  targetStateName,
  availableSignals,
  onSave,
  onClose,
}: TransitionRuleModalProps): ReactElement {
  const [rules, setRules] = useState<Rule[]>(transition.rules || []);

  const handleAddRule = () => {
    const newRule: Rule = {
      type: 'sensor',
      signalName: availableSignals[0] || '',
      operator: '>',
      value: 0,
    };
    setRules([...rules, newRule]);
  };

  const handleUpdateRule = (index: number, updatedRule: Rule) => {
    const newRules = [...rules];
    newRules[index] = updatedRule;
    setRules(newRules);
  };

  const handleDeleteRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    onSave({
      ...transition,
      rules,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div className="w-full max-w-2xl rounded-lg border border-slate-700 bg-slate-900 shadow-2xl">
        {/* Header */}
        <div className="border-b border-slate-700 p-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold text-primary-light">Transition Rules</h2>
              <p className="mt-1 text-sm text-slate-400">
                From <span className="font-medium text-slate-200">{sourceStateName}</span> to{' '}
                <span className="font-medium text-slate-200">{targetStateName}</span>
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-slate-200 text-2xl font-bold leading-none"
            >
              ×
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-h-[60vh] overflow-y-auto p-4">
          {rules.length === 0 ? (
            <div className="rounded border border-slate-700 bg-slate-800/30 p-8 text-center">
              <p className="text-sm text-slate-400">
                No rules defined yet. This transition will trigger immediately.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Add rules to control when this transition should occur.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule, index) => (
                <div
                  key={index}
                  className="rounded border border-slate-700 bg-slate-800/50 p-4"
                >
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-xs font-semibold text-slate-400">
                      Rule {index + 1}
                      {rules.length > 1 && index < rules.length - 1 && (
                        <span className="ml-2 text-primary-light">AND</span>
                      )}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleDeleteRule(index)}
                      className="rounded bg-red-900/40 px-2 py-1 text-xs font-medium text-red-300 hover:bg-red-900/60"
                    >
                      Delete Rule
                    </button>
                  </div>

                  <div className="space-y-3">
                    {/* Rule Type */}
                    <div>
                      <label className="block text-xs font-medium text-slate-300 mb-1">
                        Trigger Type
                      </label>
                      <select
                        value={rule.type}
                        onChange={(e) => {
                          const newType = e.target.value as Rule['type'];
                          const updatedRule: Rule =
                            newType === 'sensor'
                              ? {
                                  type: 'sensor',
                                  signalName: availableSignals[0] || '',
                                  operator: '>',
                                  value: 0,
                                }
                              : newType === 'timeInState'
                              ? { type: 'timeInState', seconds: 60 }
                              : { type: 'totalTime', seconds: 60 };
                          handleUpdateRule(index, updatedRule);
                        }}
                        className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white"
                      >
                        {RULE_TYPES.map((type) => (
                          <option key={type.value} value={type.value}>
                            {type.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Sensor Rule Inputs */}
                    {rule.type === 'sensor' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Signal Name
                          </label>
                          {availableSignals.length > 0 ? (
                            <select
                              value={rule.signalName || ''}
                              onChange={(e) =>
                                handleUpdateRule(index, { ...rule, signalName: e.target.value })
                              }
                              className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white"
                            >
                              {availableSignals.map((signal) => (
                                <option key={signal} value={signal}>
                                  {signal}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <input
                              type="text"
                              value={rule.signalName || ''}
                              onChange={(e) =>
                                handleUpdateRule(index, { ...rule, signalName: e.target.value })
                              }
                              placeholder="Enter signal name"
                              className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white placeholder:text-slate-500"
                            />
                          )}
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Operator
                            </label>
                            <select
                              value={rule.operator || '>'}
                              onChange={(e) =>
                                handleUpdateRule(index, {
                                  ...rule,
                                  operator: e.target.value as Rule['operator'],
                                })
                              }
                              className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white"
                            >
                              {OPERATORS.map((op) => (
                                <option key={op.value} value={op.value}>
                                  {op.label}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-xs font-medium text-slate-300 mb-1">
                              Value
                            </label>
                            <input
                              type="number"
                              step="any"
                              value={rule.value ?? 0}
                              onChange={(e) =>
                                handleUpdateRule(index, {
                                  ...rule,
                                  value: parseFloat(e.target.value),
                                })
                              }
                              className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white"
                            />
                          </div>
                        </div>

                        <div className="rounded bg-slate-900/50 p-2 text-xs text-slate-400">
                          <span className="font-medium">Preview:</span> When{' '}
                          <span className="text-primary-light">{rule.signalName || 'signal'}</span>{' '}
                          {OPERATORS.find((op) => op.value === rule.operator)?.label || '>'}{' '}
                          <span className="text-primary-light">{rule.value ?? 0}</span>
                        </div>
                      </>
                    )}

                    {/* Time in State Rule Input */}
                    {rule.type === 'timeInState' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Duration (seconds)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={rule.seconds ?? 60}
                            onChange={(e) =>
                              handleUpdateRule(index, {
                                ...rule,
                                seconds: parseInt(e.target.value),
                              })
                            }
                            className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white"
                          />
                        </div>

                        <div className="rounded bg-slate-900/50 p-2 text-xs text-slate-400">
                          <span className="font-medium">Preview:</span> After being in{' '}
                          <span className="text-primary-light">{sourceStateName}</span> for{' '}
                          <span className="text-primary-light">{rule.seconds ?? 60} seconds</span>
                        </div>
                      </>
                    )}

                    {/* Total Time Rule Input */}
                    {rule.type === 'totalTime' && (
                      <>
                        <div>
                          <label className="block text-xs font-medium text-slate-300 mb-1">
                            Duration (seconds)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="1"
                            value={rule.seconds ?? 60}
                            onChange={(e) =>
                              handleUpdateRule(index, {
                                ...rule,
                                seconds: parseInt(e.target.value),
                              })
                            }
                            className="w-full rounded border border-slate-600 bg-slate-700 px-3 py-2 text-sm text-white"
                          />
                        </div>

                        <div className="rounded bg-slate-900/50 p-2 text-xs text-slate-400">
                          <span className="font-medium">Preview:</span> After{' '}
                          <span className="text-primary-light">
                            {rule.seconds ?? 60} seconds
                          </span>{' '}
                          of total monitoring time
                        </div>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Add Rule Button */}
          <div className="mt-4">
            <button
              type="button"
              onClick={handleAddRule}
              className="w-full rounded border border-slate-600 bg-slate-800 px-3 py-2 text-sm font-medium text-slate-200 hover:bg-slate-700"
            >
              + Add Rule
            </button>
            {rules.length > 1 && (
              <p className="mt-2 text-xs text-slate-500 text-center">
                All rules must be satisfied (AND logic) for the transition to occur
              </p>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-700 p-4">
          <div className="flex gap-3 justify-end">
            <button
              type="button"
              onClick={onClose}
              className="rounded bg-slate-700 px-4 py-2 text-sm font-medium text-slate-200 hover:bg-slate-600"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="rounded bg-primary-light px-4 py-2 text-sm font-semibold text-slate-900 hover:bg-primary"
            >
              Save Rules
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
