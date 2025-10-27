// Extended instrument configuration types for advanced setup

export interface Signal {
  id: string;
  name: string;
  measureCommand: string;
}

export interface ModeParameter {
  name: string;
}

export interface Mode {
  id: string;
  name: string;
  enableCommands: string;
  disableCommands: string;
  parameters: ModeParameter[];
}

export interface SignalModeConfig {
  modeId: string;
  signalId: string;
  unit: string;
  scalingFactor: number;
}

export interface InstrumentConfiguration {
  // Step 1: Connection
  name: string;
  address: string;
  description?: string;
  
  // Step 2: Signals
  signals: Signal[];
  
  // Step 3: Modes
  modes: Mode[];
  
  // Step 4: Signal-Mode Matrix
  signalModeConfigs: SignalModeConfig[];
}
