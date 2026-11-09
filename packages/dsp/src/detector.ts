export interface PitchEstimate {
  /** Fundamental frequency in Hz. */
  frequency: number;
  /** How periodic the signal is, 0–1. */
  clarity: number;
}

/**
 * What the app depends on. A WASM detector can replace the MPM one by
 * implementing this interface.
 */
export interface PitchDetector {
  /** Number of samples `detect` expects. */
  readonly windowSize: number;
  detect(samples: Float32Array): PitchEstimate | null;
}

/** ~64 ms at 48 kHz: over five periods of low E, and short enough to respond quickly. */
export const DEFAULT_WINDOW_SIZE = 3072;
export const DEFAULT_MIN_FREQUENCY = 70;
export const DEFAULT_MAX_FREQUENCY = 1400;
