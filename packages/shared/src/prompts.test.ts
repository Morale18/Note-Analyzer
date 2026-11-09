import { describe, expect, it } from 'vitest';
import { positionsForNote } from './fretboard';
import { generatePrompt, listPrompts, noteWeight, type NoteTally } from './prompts';

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

describe('listPrompts', () => {
  it('covers every string and note pair', () => {
    expect(listPrompts(setup)).toHaveLength(42);
  });

  it('skips notes that are outside the fret range', () => {
    const prompts = listPrompts({
      selectedStrings: [0],
      selectedNotes: [4, 5, 6],
      fretMin: 1,
      fretMax: 2,
    });
    expect(prompts.map((p) => p.note)).toEqual([5, 6]);
  });
});

describe('generatePrompt', () => {
  it('only yields prompts that exist within the setup', () => {
    const rng = seededRng(1);
    for (let i = 0; i < 500; i++) {
      const prompt = generatePrompt(setup, { rng })!;
      expect(setup.selectedStrings).toContain(prompt.stringIndex);
      expect(setup.selectedNotes).toContain(prompt.note);
      expect(prompt.positions).toEqual(positionsForNote(prompt.stringIndex, prompt.note, setup));
      expect(prompt.positions.length).toBeGreaterThan(0);
    }
  });

  it('never repeats the same prompt twice in a row', () => {
    const rng = seededRng(2);
    const twoOptions = { ...setup, selectedStrings: [0], selectedNotes: [4, 5] };
    let previous = generatePrompt(twoOptions, { rng })!;
    for (let i = 0; i < 200; i++) {
      const next = generatePrompt(twoOptions, { previous, rng })!;
      expect([next.stringIndex, next.note]).not.toEqual([previous.stringIndex, previous.note]);
      previous = next;
    }
  });

  it('repeats only when a single prompt exists', () => {
    const single = { ...setup, selectedStrings: [0], selectedNotes: [4] };
    const first = generatePrompt(single)!;
    expect(generatePrompt(single, { previous: first })).toEqual(first);
  });

  it('returns null when nothing is playable', () => {
    expect(generatePrompt({ ...setup, selectedNotes: [] })).toBeNull();
  });

  it('is roughly uniform without weighting', () => {
    const rng = seededRng(3);
    const counts = new Map<number, number>();
    for (let i = 0; i < 7000; i++) {
      const { note } = generatePrompt(setup, { rng })!;
      counts.set(note, (counts.get(note) ?? 0) + 1);
    }
    for (const note of setup.selectedNotes) {
      expect(counts.get(note)!).toBeGreaterThan(850);
      expect(counts.get(note)!).toBeLessThan(1150);
    }
  });

  it('favors low-accuracy notes when weighted', () => {
    const rng = seededRng(4);
    const weakNoteTallies = new Map<number, NoteTally>([
      [4, { correct: 2, total: 20 }],
      [5, { correct: 20, total: 20 }],
    ]);
    const twoNotes = { ...setup, selectedNotes: [4, 5] };
    let weak = 0;
    for (let i = 0; i < 2000; i++) {
      if (generatePrompt(twoNotes, { weakNoteTallies, rng })!.note === 4) weak++;
    }
    expect(weak / 2000).toBeGreaterThan(0.8);
  });
});

describe('noteWeight', () => {
  it('ranks weak above unseen above mastered, and never reaches zero', () => {
    const weak = noteWeight({ correct: 0, total: 10 });
    const unseen = noteWeight(undefined);
    const mastered = noteWeight({ correct: 100, total: 100 });
    expect(weak).toBeGreaterThan(unseen);
    expect(unseen).toBeGreaterThan(mastered);
    expect(mastered).toBeGreaterThan(0);
  });
});
