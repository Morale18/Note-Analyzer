import { describe, expect, it } from 'vitest';
import { EAR_OPTION_COUNT, generateEarQuestion, listEarNotes } from './ear';
import { midiToPitchClass } from './notes';
import { listPrompts } from './prompts';

const setup = {
  selectedStrings: [0, 1, 2, 3, 4, 5],
  selectedNotes: [0, 2, 4, 5, 7, 9, 11],
  fretMin: 0,
  fretMax: 12,
};

function seededRng(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function questions(input: typeof setup, count = 200) {
  const rng = seededRng(42);
  return Array.from({ length: count }, () => generateEarQuestion(input, { rng })!);
}

describe('listEarNotes', () => {
  it('lists selected notes in chromatic order without duplicates', () => {
    expect(listEarNotes({ ...setup, selectedNotes: [9, 0, 4] })).toEqual([0, 4, 9]);
  });

  it('leaves out notes the strings and frets can’t reach', () => {
    const notes = listEarNotes({
      selectedStrings: [0],
      selectedNotes: [4, 5, 6],
      fretMin: 0,
      fretMax: 1,
    });
    expect(notes).toEqual([4, 5]);
  });
});

describe('generateEarQuestion', () => {
  it('returns null when the setup has no notes', () => {
    expect(generateEarQuestion({ ...setup, selectedNotes: [] })).toBeNull();
  });

  it('always offers three different options including the answer', () => {
    for (const question of questions(setup)) {
      expect(question.options).toHaveLength(EAR_OPTION_COUNT);
      expect(new Set(question.options).size).toBe(EAR_OPTION_COUNT);
      expect(question.options).toContain(question.note);
    }
  });

  it('only asks about selected notes', () => {
    for (const question of questions(setup)) {
      expect(setup.selectedNotes).toContain(question.note);
    }
  });

  it('plays a pitch that matches the note and sits in the fret range', () => {
    const allowed = new Set(
      listPrompts(setup).flatMap((p) => p.positions.map((position) => position.midi)),
    );
    for (const question of questions(setup)) {
      expect(midiToPitchClass(question.midi)).toBe(question.note);
      expect(allowed.has(question.midi)).toBe(true);
    }
  });

  it('draws wrong answers from the selected notes when there are enough', () => {
    for (const question of questions({ ...setup, selectedNotes: [0, 4, 7, 9] })) {
      for (const option of question.options) expect([0, 4, 7, 9]).toContain(option);
    }
  });

  it('fills the options from outside the setup when it has too few notes', () => {
    for (const question of questions({ ...setup, selectedNotes: [9] })) {
      expect(question.note).toBe(9);
      expect(new Set(question.options).size).toBe(EAR_OPTION_COUNT);
    }
  });

  it('keeps every selected note in the options when exactly two are selected', () => {
    for (const question of questions({ ...setup, selectedNotes: [0, 9] })) {
      expect(question.options).toEqual(expect.arrayContaining([0, 9]));
    }
  });

  it('doesn’t repeat the previous note', () => {
    const rng = seededRng(7);
    for (let i = 0; i < 200; i++) {
      expect(generateEarQuestion(setup, { previousNote: 9, rng })!.note).not.toBe(9);
    }
  });

  it('repeats the note when it’s the only one available', () => {
    const question = generateEarQuestion({ ...setup, selectedNotes: [9] }, { previousNote: 9 });
    expect(question!.note).toBe(9);
  });
});
