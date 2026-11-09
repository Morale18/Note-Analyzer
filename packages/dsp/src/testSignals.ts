/** Synthetic test signals. Only imported by tests. */

export function midiToHz(midi: number): number {
  return 440 * 2 ** ((midi - 69) / 12);
}

export function centsBetween(a: number, b: number): number {
  return 1200 * Math.log2(a / b);
}

export function sine(frequency: number, sampleRate: number, length: number, amplitude = 0.5) {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    out[i] = amplitude * Math.sin((2 * Math.PI * frequency * i) / sampleRate);
  }
  return out;
}

export function sawtooth(frequency: number, sampleRate: number, length: number, amplitude = 0.5) {
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    const phase = (frequency * i) / sampleRate;
    out[i] = amplitude * 2 * (phase - Math.floor(phase + 0.5));
  }
  return out;
}

export interface HarmonicOptions {
  /** Relative amplitude of each harmonic, starting at the fundamental. */
  amplitudes?: readonly number[];
  /** String stiffness coefficient that sharpens upper partials. */
  inharmonicity?: number;
  /** Decay in 1/s of the fundamental; upper partials decay proportionally faster. */
  decay?: number;
  startTimeS?: number;
}

export const GUITAR_AMPLITUDES = [1, 0.7, 0.5, 0.35, 0.25, 0.15, 0.1, 0.05];

export function guitarLike(
  frequency: number,
  sampleRate: number,
  length: number,
  {
    amplitudes = GUITAR_AMPLITUDES,
    inharmonicity = 0.00008,
    decay = 2,
    startTimeS = 0.05,
  }: HarmonicOptions = {},
) {
  const out = new Float32Array(length);
  amplitudes.forEach((amplitude, index) => {
    const n = index + 1;
    const partial = n * frequency * Math.sqrt(1 + inharmonicity * n * n);
    if (partial >= sampleRate / 2) return;
    const phase = 1.3 * n;
    for (let i = 0; i < length; i++) {
      const t = startTimeS + i / sampleRate;
      out[i] +=
        0.2 * amplitude * Math.exp(-decay * (1 + 0.3 * index) * t) *
        Math.sin(2 * Math.PI * partial * t + phase);
    }
  });
  return out;
}

export function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function whiteNoise(length: number, amplitude = 0.3, seed = 1) {
  const random = seededRandom(seed);
  const out = new Float32Array(length);
  for (let i = 0; i < length; i++) out[i] = amplitude * (2 * random() - 1);
  return out;
}

export function mix(a: Float32Array, b: Float32Array) {
  return a.map((value, i) => value + b[i]);
}
