import { describe, expect, it } from 'vitest';
import { rms } from './level';
import { computeNsdf, createMpmDetector, detectPitchMpm, findKeyMaxima, selectPeak } from './mpm';
import {
  centsBetween,
  guitarLike,
  midiToHz,
  mix,
  sawtooth,
  sine,
  whiteNoise,
} from './testSignals';

const OPEN_STRINGS = [40, 45, 50, 55, 59, 64];
const FRETTED = [41, 47, 54, 61, 66, 69, 76, 88];
const NOTES = [...OPEN_STRINGS, ...FRETTED];
const SAMPLE_RATES = [44100, 48000];
const WINDOW_SIZES = [2048, 3072, 4096];

function expectNote(
  signal: Float32Array,
  sampleRate: number,
  midi: number,
  toleranceCents: number,
) {
  const result = detectPitchMpm(signal, { sampleRate });
  expect(result).not.toBeNull();
  expect(Math.abs(centsBetween(result!.frequency, midiToHz(midi)))).toBeLessThan(toleranceCents);
  return result!;
}

describe.each(SAMPLE_RATES)('detectPitchMpm at %i Hz', (sampleRate) => {
  describe.each(WINDOW_SIZES)('window %i', (windowSize) => {
    it.each(NOTES)('finds a sine at MIDI %i', (midi) => {
      const result = expectNote(sine(midiToHz(midi), sampleRate, windowSize), sampleRate, midi, 5);
      expect(result.clarity).toBeGreaterThan(0.95);
    });

    it.each(NOTES)('finds a sawtooth at MIDI %i', (midi) => {
      const signal = sawtooth(midiToHz(midi), sampleRate, windowSize);
      expect(expectNote(signal, sampleRate, midi, 15).clarity).toBeGreaterThan(0.9);
    });

    it.each(NOTES)('finds guitar-like harmonics at MIDI %i', (midi) => {
      const signal = guitarLike(midiToHz(midi), sampleRate, windowSize);
      expect(expectNote(signal, sampleRate, midi, 15).clarity).toBeGreaterThan(0.9);
    });
  });
});

describe('octave-error guarding', () => {
  const sampleRate = 48000;
  const windowSize = 3072;

  it.each(OPEN_STRINGS)('keeps MIDI %i when the second harmonic dominates', (midi) => {
    const signal = guitarLike(midiToHz(midi), sampleRate, windowSize, {
      amplitudes: [0.4, 1, 0.3, 0.5, 0.15, 0.1],
    });
    expectNote(signal, sampleRate, midi, 15);
  });

  it.each(OPEN_STRINGS)('keeps MIDI %i with a very weak fundamental', (midi) => {
    const signal = guitarLike(midiToHz(midi), sampleRate, windowSize, {
      amplitudes: [0.1, 1, 0.5, 0.6, 0.2, 0.15],
    });
    expectNote(signal, sampleRate, midi, 15);
  });

  it.each(OPEN_STRINGS)('keeps MIDI %i when the third harmonic dominates', (midi) => {
    const signal = guitarLike(midiToHz(midi), sampleRate, windowSize, {
      amplitudes: [0.3, 0.3, 1, 0.2, 0.1],
    });
    expectNote(signal, sampleRate, midi, 15);
  });

  it('does not drop a pure tone an octave', () => {
    expectNote(sine(midiToHz(64), sampleRate, windowSize), sampleRate, 64, 5);
  });

  it('prefers a later peak only when it is clearly higher', () => {
    const halfPeriod = { tau: 100, value: 0.94 };
    const fullPeriod = { tau: 200, value: 0.99 };
    expect(selectPeak([halfPeriod, fullPeriod], 0.93, 0.03)).toBe(fullPeriod);

    const nearlyEqual = { tau: 200, value: 0.95 };
    expect(selectPeak([halfPeriod, nearlyEqual], 0.93, 0.03)).toBe(halfPeriod);
  });

  it('leaves short periods alone', () => {
    const halfPeriod = { tau: 30, value: 0.94 };
    const fullPeriod = { tau: 60, value: 0.99 };
    expect(selectPeak([halfPeriod, fullPeriod], 0.93, 0.03, 40)).toBe(halfPeriod);
  });

  it('takes the first peak above the threshold', () => {
    const first = { tau: 50, value: 0.97 };
    const second = { tau: 100, value: 0.98 };
    expect(selectPeak([first, second], 0.93, 0.03)).toBe(first);
  });
});

describe('noise and silence', () => {
  const sampleRate = 48000;
  const windowSize = 3072;

  it('returns null for silence', () => {
    expect(detectPitchMpm(new Float32Array(windowSize), { sampleRate })).toBeNull();
  });

  it('returns null for pure DC', () => {
    expect(detectPitchMpm(new Float32Array(windowSize).fill(0.5), { sampleRate })).toBeNull();
  });

  it.each([1, 2, 3, 4, 5])('reports low clarity for white noise (seed %i)', (seed) => {
    const result = detectPitchMpm(whiteNoise(windowSize, 0.3, seed), { sampleRate });
    expect(result?.clarity ?? 0).toBeLessThan(0.5);
  });

  it.each(OPEN_STRINGS)('finds MIDI %i through moderate noise', (midi) => {
    const clean = guitarLike(midiToHz(midi), sampleRate, windowSize);
    const noisy = mix(clean, whiteNoise(windowSize, rms(clean) * 0.2));
    const result = expectNote(noisy, sampleRate, midi, 20);
    expect(result.clarity).toBeGreaterThan(0.85);
  });

  it('ignores a DC offset', () => {
    const signal = sine(midiToHz(45), sampleRate, windowSize).map((v) => v + 0.3);
    expectNote(signal, sampleRate, 45, 5);
  });

  it('rejects tones below the frequency range', () => {
    const result = detectPitchMpm(sine(40, sampleRate, windowSize), { sampleRate });
    expect(result).toBeNull();
  });
});

describe('computeNsdf and findKeyMaxima', () => {
  it('is 1 at lag zero and peaks at the period', () => {
    const period = 100;
    const signal = sine(480, 48000, 2048);
    const nsdf = computeNsdf(signal, 300);
    expect(nsdf[0]).toBeCloseTo(1, 5);
    const maxima = findKeyMaxima(nsdf, 2);
    expect(maxima[0]!.tau).toBe(period);
    expect(maxima[0]!.value).toBeGreaterThan(0.99);
  });

  it('drops peaks below the minimum lag', () => {
    const nsdf = computeNsdf(sine(480, 48000, 2048), 300);
    expect(findKeyMaxima(nsdf, 150)[0]!.tau).toBe(200);
  });

  it('ignores a peak that may still be climbing at the end of the range', () => {
    const nsdf = Float32Array.from([1, 0.5, -0.5, 0.1, 0.2, 0.3]);
    expect(findKeyMaxima(nsdf, 1)).toEqual([]);
  });
});

describe('createMpmDetector', () => {
  it('implements the PitchDetector interface and is reusable', () => {
    const detector = createMpmDetector({ sampleRate: 48000, windowSize: 2048 });
    expect(detector.windowSize).toBe(2048);
    for (const midi of [40, 64, 45]) {
      const result = detector.detect(sine(midiToHz(midi), 48000, 2048));
      expect(Math.abs(centsBetween(result!.frequency, midiToHz(midi)))).toBeLessThan(5);
    }
  });

  it('is fast enough for the audio thread', () => {
    const detector = createMpmDetector({ sampleRate: 48000 });
    const signal = guitarLike(midiToHz(40), 48000, detector.windowSize);
    detector.detect(signal);
    const start = Date.now();
    for (let i = 0; i < 20; i++) detector.detect(signal);
    expect((Date.now() - start) / 20).toBeLessThan(21);
  });
});

describe('rms', () => {
  it('is 0 for silence and empty input', () => {
    expect(rms(new Float32Array(128))).toBe(0);
    expect(rms(new Float32Array(0))).toBe(0);
  });

  it('is amplitude / √2 for a sine', () => {
    expect(rms(sine(480, 48000, 4800, 0.5))).toBeCloseTo(0.5 / Math.SQRT2, 3);
  });

  it('equals the level of a constant signal', () => {
    expect(rms(new Float32Array(64).fill(0.25))).toBeCloseTo(0.25, 6);
  });
});
