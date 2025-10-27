import { useState } from 'react';
import type { ReactElement } from 'react';
import { v4 as uuidv4 } from 'uuid';
import type {
  InstrumentConfiguration,
  Signal,
  Mode,
  SignalModeConfig,
} from '../../types/instrumentConfig';
import { ConnectionStep } from './wizard/ConnectionStep';
import { SignalsStep } from './wizard/SignalsStep';
import { ModesStep } from './wizard/ModesStep';
import { SignalModeMatrixStep } from './wizard/SignalModeMatrixStep';
import { createInstrument } from '../../services/instrumentService';

interface Props {
  onComplete: () => void;
  onCancel: () => void;
}

export function InstrumentWizard({ onComplete, onCancel }: Props): ReactElement {
  const [currentStep, setCurrentStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [config, setConfig] = useState<InstrumentConfiguration>({
    name: '',
    address: '',
    description: '',
    signals: [],
    modes: [],
    signalModeConfigs: [],
  });

  const updateConfig = (updates: Partial<InstrumentConfiguration>) => {
    setConfig((prev) => ({ ...prev, ...updates }));
  };

  const addSignal = () => {
    const newSignal: Signal = {
      id: uuidv4(),
      name: '',
      measureCommand: '',
    };
    updateConfig({ signals: [...config.signals, newSignal] });
  };

  const updateSignal = (id: string, updates: Partial<Signal>) => {
    const updated = config.signals.map((s) => (s.id === id ? { ...s, ...updates } : s));
    updateConfig({ signals: updated });
  };

  const removeSignal = (id: string) => {
    updateConfig({
      signals: config.signals.filter((s) => s.id !== id),
      signalModeConfigs: config.signalModeConfigs.filter((c) => c.signalId !== id),
    });
  };

  const addMode = () => {
    const newMode: Mode = {
      id: uuidv4(),
      name: '',
      enableCommands: '',
      disableCommands: '',
      parameters: [],
    };
    updateConfig({ modes: [...config.modes, newMode] });
  };

  const updateMode = (id: string, updates: Partial<Mode>) => {
    const updated = config.modes.map((m) => (m.id === id ? { ...m, ...updates } : m));
    updateConfig({ modes: updated });
  };

  const removeMode = (id: string) => {
    updateConfig({
      modes: config.modes.filter((m) => m.id !== id),
      signalModeConfigs: config.signalModeConfigs.filter((c) => c.modeId !== id),
    });
  };

  const updateSignalModeConfig = (
    modeId: string,
    signalId: string,
    updates: Partial<SignalModeConfig>
  ) => {
    const existing = config.signalModeConfigs.find(
      (c) => c.modeId === modeId && c.signalId === signalId
    );
    if (existing) {
      const updated = config.signalModeConfigs.map((c) =>
        c.modeId === modeId && c.signalId === signalId ? { ...c, ...updates } : c
      );
      updateConfig({ signalModeConfigs: updated });
    } else {
      const newConfig: SignalModeConfig = {
        modeId,
        signalId,
        unit: '',
        scalingFactor: 1,
        ...updates,
      };
      updateConfig({ signalModeConfigs: [...config.signalModeConfigs, newConfig] });
    }
  };

  const canProceedToStep2 = (() => {
    if (config.name.trim() === '' || config.address.trim() === '') return false;
    // Validate format: IP/Identifier
    const parts = config.address.split('/');
    if (parts.length !== 2) return false;
    const [ip, identifier] = parts;
    return ip.trim() !== '' && identifier.trim() !== '';
  })();
  const canProceedToStep3 = config.signals.length > 0 && config.signals.every((s) => s.name && s.measureCommand);
  const canProceedToStep4 = config.modes.length > 0 && config.modes.every((m) => m.name);
  const canSubmit = config.signals.length > 0 && config.modes.length > 0;

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      // Serialize the complete configuration as JSON in the description field
      const payload = {
        name: config.name,
        address: config.address,
        description: JSON.stringify({
          description: config.description,
          signals: config.signals,
          modes: config.modes,
          signalModeConfigs: config.signalModeConfigs,
        }),
        is_active: true,
      };
      await createInstrument(payload);
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create instrument');
      setSubmitting(false);
    }
  };

  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900 p-6">
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-xl font-semibold text-primary-light">Configure New Instrument</h2>
        <button
          type="button"
          onClick={onCancel}
          className="text-sm text-slate-400 hover:text-slate-200"
        >
          Cancel
        </button>
      </div>

      {/* Progress Indicator */}
      <div className="mb-8 flex items-center justify-between">
        {[1, 2, 3, 4].map((step) => (
          <div key={step} className="flex items-center">
            <div
              className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-medium ${
                currentStep === step
                  ? 'bg-primary-light text-slate-900'
                  : currentStep > step
                  ? 'bg-primary-dark text-white'
                  : 'bg-slate-800 text-slate-400'
              }`}
            >
              {step}
            </div>
            {step < 4 && (
              <div
                className={`mx-2 h-0.5 w-16 ${
                  currentStep > step ? 'bg-primary-dark' : 'bg-slate-800'
                }`}
              />
            )}
          </div>
        ))}
      </div>

      {/* Step Labels */}
      <div className="mb-6 text-center">
        <h3 className="text-lg font-medium text-white">
          {currentStep === 1 && 'Step 1: Basic Connection Details'}
          {currentStep === 2 && 'Step 2: Define Signals'}
          {currentStep === 3 && 'Step 3: Define Modes and Parameters'}
          {currentStep === 4 && 'Step 4: Configure Signals Within Each Mode'}
        </h3>
        <p className="mt-1 text-sm text-slate-400">
          {currentStep === 1 && 'Provide the VXI-11 instrument connection information'}
          {currentStep === 2 && 'Define the signals this instrument can measure'}
          {currentStep === 3 && 'Define operational modes with enable/disable commands'}
          {currentStep === 4 && 'Link signals and modes with units and scaling'}
        </p>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 rounded border border-red-500 bg-red-900/40 p-3 text-sm text-red-200">
          {error}
        </div>
      )}

      {/* Step Content */}
      <div className="mb-6">
        {currentStep === 1 && (
          <ConnectionStep
            name={config.name}
            address={config.address}
            description={config.description || ''}
            onChange={(field, value) => updateConfig({ [field]: value })}
          />
        )}
        {currentStep === 2 && (
          <SignalsStep
            signals={config.signals}
            onAdd={addSignal}
            onUpdate={updateSignal}
            onRemove={removeSignal}
          />
        )}
        {currentStep === 3 && (
          <ModesStep
            modes={config.modes}
            onAdd={addMode}
            onUpdate={updateMode}
            onRemove={removeMode}
          />
        )}
        {currentStep === 4 && (
          <SignalModeMatrixStep
            signals={config.signals}
            modes={config.modes}
            signalModeConfigs={config.signalModeConfigs}
            onUpdateConfig={updateSignalModeConfig}
          />
        )}
      </div>

      {/* Navigation Buttons */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => setCurrentStep((s) => Math.max(1, s - 1))}
          disabled={currentStep === 1}
          className="rounded bg-slate-800 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Previous
        </button>

        {currentStep < 4 ? (
          <button
            type="button"
            onClick={() => setCurrentStep((s) => s + 1)}
            disabled={
              (currentStep === 1 && !canProceedToStep2) ||
              (currentStep === 2 && !canProceedToStep3) ||
              (currentStep === 3 && !canProceedToStep4)
            }
            className="rounded bg-primary-light px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-primary-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            Next
          </button>
        ) : (
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!canSubmit || submitting}
            className="rounded bg-primary-light px-4 py-2 text-sm font-medium text-slate-900 transition hover:bg-primary-dark hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
          >
            {submitting ? 'Creating...' : 'Create Instrument'}
          </button>
        )}
      </div>
    </div>
  );
}
