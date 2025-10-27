export interface InstrumentBase {
  name: string;
  address: string;
  description?: string | null;
  is_active?: boolean;
}

export interface Instrument extends InstrumentBase {
  id: number;
}
