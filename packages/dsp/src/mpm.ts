import {
  DEFAULT_MAX_FREQUENCY,
  DEFAULT_MIN_FREQUENCY,
  DEFAULT_WINDOW_SIZE,
  type PitchDetector,
  type PitchEstimate,
} from './detector';

export interface MpmOptions {
  sampleRate: number;
  minFrequency?: number;
  maxFrequency?: number;
  /** Take the first peak reaching this fraction of the highest peak (McLeod's k). */
  peakThreshold?: number;
  /** How much higher a peak at a multiple of the period must be to override the chosen one. */
  octaveMargin?: number;
}

export interface KeyMaximum {
  tau: number;
  value: number;
}

export interface MpmScratch {
  centered: Float32Array;
  nsdf: Float32Array;
}

const DEFAULT_PEAK_THRESHOLD = 0.93;
const DEFAULT_OCTAVE_MARGIN = 0.03;
/** Weak fundamentals only affect low notes, and short lags are too coarse to compare reliably. */
const OCTAVE_GUARD_MAX_FREQUENCY = 700;
const SILENCE_ENERGY = 1e-12;

function maxTauFor(sampleRate: number, minFrequency: number): number {
  return Math.ceil(sampleRate / minFrequency) + 1;
}

/** Normalized square difference function n'(τ) for τ in [0, maxTau]. */
export function computeNsdf(
  samples: Float32Array,
  maxTau: number,
  output: Float32Array = new Float32Array(maxTau + 1),
): Float32Array {
  const n = samples.length;
  let m = 0;
  for (let i = 0; i < n; i++) m += 2 * samples[i] * samples[i];

  for (let tau = 0; tau <= maxTau; tau++) {
    if (tau > 0) {
      const leaving = samples[tau - 1];
      const entering = samples[n - tau];
      m -= leaving * leaving + entering * entering;
    }
    let acf = 0;
    for (let i = 0, j = tau; j < n; i++, j++) acf += samples[i] * samples[j];
    output[tau] = m > SILENCE_ENERGY ? (2 * acf) / m : 0;
  }
  return output;
}

/** The highest point of each positive lobe after the lobe around τ = 0. */
export function findKeyMaxima(nsdf: Float32Array, minTau: number): KeyMaximum[] {
  const maxima: KeyMaximum[] = [];
  const end = nsdf.length;
  let i = 1;
  while (i < end && nsdf[i] > 0) i++;

  while (i < end) {
    while (i < end && nsdf[i] <= 0) i++;
    let bestTau = -1;
    let bestValue = -Infinity;
    for (; i < end && nsdf[i] > 0; i++) {
      if (nsdf[i] > bestValue) {
        bestValue = nsdf[i];
        bestTau = i;
      }
    }
    // A maximum on the last sample may still be climbing, so it isn't a real peak.
    if (bestTau >= minTau && bestTau >= 1 && bestTau < end - 1) {
      maxima.push({ tau: bestTau, value: bestValue });
    }
  }
  return maxima;
}

function refinePeak(nsdf: Float32Array, tau: number): KeyMaximum {
  const left = nsdf[tau - 1];
  const center = nsdf[tau];
  const right = nsdf[tau + 1];
  const curvature = left - 2 * center + right;
  if (curvature === 0) return { tau, value: center };
  const delta = (0.5 * (left - right)) / curvature;
  return { tau: tau + delta, value: center - 0.25 * (left - right) * delta };
}

/**
 * McLeod's first-peak-above-threshold rule, which avoids sub-octave errors, then a
 * check for octave-high errors: when a string's fundamental is weak (typical of low
 * notes on a phone mic) a half-period peak can clear the threshold, but the true
 * period at a multiple of it still scores clearly higher.
 */
export function selectPeak(
  maxima: KeyMaximum[],
  peakThreshold: number,
  octaveMargin: number,
  octaveGuardMinTau = 0,
): KeyMaximum | null {
  if (maxima.length === 0) return null;
  const threshold = peakThreshold * Math.max(...maxima.map((m) => m.value));
  let chosen = maxima.find((m) => m.value >= threshold)!;
  if (chosen.tau < octaveGuardMinTau) return chosen;

  for (const multiple of [2, 3]) {
    const expected = chosen.tau * multiple;
    const tolerance = Math.max(2, expected * 0.03);
    const better = maxima.find(
      (m) => Math.abs(m.tau - expected) <= tolerance && m.value > chosen.value + octaveMargin,
    );
    if (better) {
      chosen = better;
      break;
    }
  }
  return chosen;
}

export function createMpmScratch(windowSize: number, maxTau: number): MpmScratch {
  return { centered: new Float32Array(windowSize), nsdf: new Float32Array(maxTau + 1) };
}

/** Estimates the pitch of `samples`, or null if no periodic signal is in range. */
export function detectPitchMpm(
  samples: Float32Array,
  options: MpmOptions,
  scratch?: MpmScratch,
): PitchEstimate | null {
  const {
    sampleRate,
    minFrequency = DEFAULT_MIN_FREQUENCY,
    maxFrequency = DEFAULT_MAX_FREQUENCY,
    peakThreshold = DEFAULT_PEAK_THRESHOLD,
    octaveMargin = DEFAULT_OCTAVE_MARGIN,
  } = options;

  const maxTau = Math.min(maxTauFor(sampleRate, minFrequency), samples.length - 1);
  const { centered, nsdf } = scratch ?? createMpmScratch(samples.length, maxTau);

  let mean = 0;
  for (let i = 0; i < samples.length; i++) mean += samples[i];
  mean /= samples.length;
  for (let i = 0; i < samples.length; i++) centered[i] = samples[i] - mean;

  computeNsdf(centered, maxTau, nsdf);
  const minTau = Math.floor(sampleRate / maxFrequency);
  // Compare interpolated peaks: at short periods the value at a whole-sample lag reads low.
  const maxima = findKeyMaxima(nsdf, minTau).map((m) => refinePeak(nsdf, m.tau));
  const peak = selectPeak(
    maxima,
    peakThreshold,
    octaveMargin,
    sampleRate / OCTAVE_GUARD_MAX_FREQUENCY,
  );
  if (!peak) return null;

  const frequency = sampleRate / peak.tau;
  if (frequency < minFrequency || frequency > maxFrequency) return null;
  return { frequency, clarity: Math.min(1, peak.value) };
}

export interface MpmDetectorOptions extends MpmOptions {
  windowSize?: number;
}

/** An allocation-free MPM detector, safe to call from the audio thread. */
export function createMpmDetector(options: MpmDetectorOptions): PitchDetector {
  const { windowSize = DEFAULT_WINDOW_SIZE, ...mpm } = options;
  const maxTau = Math.min(
    maxTauFor(mpm.sampleRate, mpm.minFrequency ?? DEFAULT_MIN_FREQUENCY),
    windowSize - 1,
  );
  const scratch = createMpmScratch(windowSize, maxTau);
  return {
    windowSize,
    detect: (samples) => detectPitchMpm(samples, mpm, scratch),
  };
}
