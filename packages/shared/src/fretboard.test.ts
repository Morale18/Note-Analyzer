import { describe, expect, it } from 'vitest';
import { STANDARD_TUNING, positionsForNote, validateSetup } from './fretboard';

const range = { fretMin: 0, fretMax: 12 };

describe('STANDARD_TUNING', () => {
  it('is E2 A2 D3 G3 B3 E4', () => {
    expect(STANDARD_TUNING).toEqual([40, 45, 50, 55, 59, 64]);
  });
});

describe('positionsForNote', () => {
  it('finds both the open string and the octave', () => {
    expect(positionsForNote(0, 4, range)).toEqual([
      { fret: 0, midi: 40 },
      { fret: 12, midi: 52 },
    ]);
  });

  it('finds a fretted note', () => {
    expect(positionsForNote(1, 6, range)).toEqual([{ fret: 9, midi: 54 }]);
  });

  it('respects the fret range', () => {
    expect(positionsForNote(0, 4, { fretMin: 1, fretMax: 11 })).toEqual([]);
    expect(positionsForNote(0, 4, { fretMin: 1, fretMax: 12 })).toEqual([{ fret: 12, midi: 52 }]);
  });

  it('finds three positions over two octaves', () => {
    expect(positionsForNote(5, 4, { fretMin: 0, fretMax: 24 }).map((p) => p.midi)).toEqual([
      64, 76, 88,
    ]);
  });

  it('returns nothing for an unknown string', () => {
    expect(positionsForNote(6, 4, range)).toEqual([]);
  });
});

describe('validateSetup', () => {
  const valid = { selectedStrings: [0], selectedNotes: [4], ...range };

  it('accepts a playable setup', () => {
    expect(validateSetup(valid)).toEqual([]);
  });

  it('requires strings and notes', () => {
    const errors = validateSetup({ ...valid, selectedStrings: [], selectedNotes: [] });
    expect(errors).toEqual(['Select at least one string.', 'Select at least one note.']);
  });

  it('rejects an inverted fret range', () => {
    expect(validateSetup({ ...valid, fretMin: 5, fretMax: 2 })).toHaveLength(1);
  });

  it('rejects a range holding none of the selected notes', () => {
    const errors = validateSetup({ ...valid, fretMin: 1, fretMax: 2 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('between frets 1 and 2');
  });
});
