import { describe, expect, it } from 'vitest';
import { midiToFrequency } from './notes';
import { TUNINGS, findTuning, stringOffsetCents } from './tunings';

const cents = (midi: number, offset: number) => midiToFrequency(midi) * 2 ** (offset / 1200);

describe('TUNINGS', () => {
  it('has unique ids', () => {
    expect(new Set(TUNINGS.map((t) => t.id)).size).toBe(TUNINGS.length);
  });

  it.each(TUNINGS.map((t) => [t.name, t.strings] as const))(
    '%s has six strings, low to high',
    (_name, strings) => {
      expect(strings).toHaveLength(6);
      expect([...strings].sort((a, b) => a - b)).toEqual(strings);
    },
  );

  it('drops only the low string for Drop D', () => {
    expect(findTuning('drop-d').strings).toEqual([38, 45, 50, 55, 59, 64]);
  });
});

describe('findTuning', () => {
  it('falls back to standard', () => {
    expect(findTuning('nope').id).toBe('standard');
    expect(findTuning(null).id).toBe('standard');
  });
});

describe('stringOffsetCents', () => {
  it('reports flat as negative and sharp as positive', () => {
    expect(stringOffsetCents(cents(45, -20), 45)).toBeCloseTo(-20);
    expect(stringOffsetCents(cents(45, 12), 45)).toBeCloseTo(12);
  });

  it('measures a string that is far off', () => {
    expect(stringOffsetCents(midiToFrequency(40), 38)).toBeCloseTo(200);
  });

  it('rejects pitches too far away to be the string', () => {
    expect(stringOffsetCents(midiToFrequency(64), 55)).toBeNull();
    expect(stringOffsetCents(midiToFrequency(40), 55)).toBeNull();
  });

  it('folds an octave-high reading on a low string', () => {
    expect(stringOffsetCents(cents(52, -15), 40)).toBeCloseTo(-15);
  });

  it('does not fold on higher strings', () => {
    expect(stringOffsetCents(midiToFrequency(74), 62)).toBeNull();
  });

  it('does not treat a low octave as the target', () => {
    expect(stringOffsetCents(midiToFrequency(38), 50)).toBeNull();
  });
});
