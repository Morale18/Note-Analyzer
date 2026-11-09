import { describe, expect, it } from 'vitest';
import {
  centsOffset,
  frequencyToMidi,
  midiToFrequency,
  midiToNoteName,
  midiToPitchClass,
  pitchClassName,
} from './notes';

describe('frequency and MIDI conversion', () => {
  it('anchors A4 to 440 Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440, 10);
    expect(frequencyToMidi(440)).toBe(69);
  });

  it.each([
    [40, 82.407],
    [45, 110],
    [50, 146.832],
    [55, 195.998],
    [59, 246.942],
    [64, 329.628],
  ])('maps open string MIDI %i to %f Hz', (midi, frequency) => {
    expect(midiToFrequency(midi)).toBeCloseTo(frequency, 2);
    expect(frequencyToMidi(frequency)).toBe(midi);
  });

  it('rounds to the nearest note', () => {
    expect(frequencyToMidi(440 * 2 ** (0.4 / 12))).toBe(69);
    expect(frequencyToMidi(440 * 2 ** (0.6 / 12))).toBe(70);
  });
});

describe('centsOffset', () => {
  it('is zero on pitch', () => {
    expect(centsOffset(440)).toBeCloseTo(0, 8);
  });

  it('measures sharp and flat offsets', () => {
    expect(centsOffset(440 * 2 ** (20 / 1200))).toBeCloseTo(20, 8);
    expect(centsOffset(440 * 2 ** (-30 / 1200))).toBeCloseTo(-30, 8);
  });

  it('can measure against an explicit note', () => {
    expect(centsOffset(440, 68)).toBeCloseTo(100, 8);
  });
});

describe('note names', () => {
  it('spells accidentals as sharps or flats', () => {
    expect(pitchClassName(6, 'sharps')).toBe('F♯');
    expect(pitchClassName(6, 'flats')).toBe('G♭');
    expect(pitchClassName(0, 'flats')).toBe('C');
  });

  it('includes the octave for MIDI names', () => {
    expect(midiToNoteName(40)).toBe('E2');
    expect(midiToNoteName(60)).toBe('C4');
    expect(midiToNoteName(66, 'sharps')).toBe('F♯4');
    expect(midiToNoteName(70, 'flats')).toBe('B♭4');
  });

  it('computes pitch classes', () => {
    expect(midiToPitchClass(40)).toBe(4);
    expect(midiToPitchClass(60)).toBe(0);
  });
});
