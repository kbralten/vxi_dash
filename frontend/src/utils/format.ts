export interface FormattedValue {
  value: number;
  valueDisplay: string;
  unitDisplay: string;
  factor: number;
}

const SCALE_UNITS = new Set(['V', 'A', 'Ω', 'Hz', 'W', 's']);
const NO_SCALE_UNITS = new Set(['dB', 'dBm', '°C', '', undefined as unknown as string]);

// Ordered from largest to smallest for selection
const SI_PREFIXES: Array<{ prefix: string; factor: number }> = [
  { prefix: 'T', factor: 1e12 },
  { prefix: 'G', factor: 1e9 },
  { prefix: 'M', factor: 1e6 },
  { prefix: 'k', factor: 1e3 },
  { prefix: '', factor: 1 },
  { prefix: 'm', factor: 1e-3 },
  { prefix: 'µ', factor: 1e-6 },
  { prefix: 'n', factor: 1e-9 },
];

/**
 * Format a numeric value and base unit for UI display using SI prefixes so that
 * 1 <= |displayed value| < 1000 when possible. Does not mutate the original value.
 */
export function formatWithSIPrefix(value: number | null | undefined, unit?: string, digits = 2): FormattedValue {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return { value: NaN, valueDisplay: 'N/A', unitDisplay: unit || '', factor: 1 };
  }
  const baseUnit = unit || '';
  if (NO_SCALE_UNITS.has(baseUnit) || !SCALE_UNITS.has(baseUnit)) {
    // Show as-is for unsupported or non-scalable units
    return {
      value,
      valueDisplay: value.toFixed(digits),
      unitDisplay: baseUnit,
      factor: 1,
    };
  }

  const abs = Math.abs(value);
  // If the value is 0, leave unit unchanged
  if (abs === 0) {
    return { value, valueDisplay: value.toFixed(digits), unitDisplay: baseUnit, factor: 1 };
  }

  // Choose the first prefix that yields 1 <= scaled < 1000
  for (const { prefix, factor } of SI_PREFIXES) {
    const scaled = value / factor;
    const absScaled = abs / factor;
    if (absScaled >= 1 && absScaled < 1000) {
      return {
        value: scaled,
        valueDisplay: scaled.toFixed(digits),
        unitDisplay: `${prefix}${baseUnit}`,
        factor,
      };
    }
  }

  // Fallback: pick the smallest prefix if value is still too small, or largest if too big
  if (abs < 1e-9) {
    const last = SI_PREFIXES[SI_PREFIXES.length - 1];
    const scaled = value / last.factor;
    return {
      value: scaled,
      valueDisplay: scaled.toFixed(digits),
      unitDisplay: `${last.prefix}${baseUnit}`,
      factor: last.factor,
    };
  }
  const first = SI_PREFIXES[0];
  const scaled = value / first.factor;
  return {
    value: scaled,
    valueDisplay: scaled.toFixed(digits),
    unitDisplay: `${first.prefix}${baseUnit}`,
    factor: first.factor,
  };
}
