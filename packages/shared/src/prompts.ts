import { positionsForNote, type FretPosition, type PracticeSetup } from './fretboard';

export interface Prompt {
  stringIndex: number;
  /** Pitch class of the target note, C = 0. */
  note: number;
  /** Every in-range position that counts as correct. */
  positions: FretPosition[];
}

/** Correct/total counts for one pitch class. */
export interface NoteTally {
  correct: number;
  total: number;
}

export type NoteTallies = ReadonlyMap<number, NoteTally>;

export interface GeneratePromptOptions {
  previous?: Pick<Prompt, 'stringIndex' | 'note'> | null;
  /** When present, notes with low accuracy are picked more often. */
  weakNoteTallies?: NoteTallies | null;
  rng?: () => number;
}

/** All (string, note) pairs that exist within the setup's fret range. */
export function listPrompts(setup: PracticeSetup): Prompt[] {
  const prompts: Prompt[] = [];
  for (const stringIndex of setup.selectedStrings) {
    for (const note of setup.selectedNotes) {
      const positions = positionsForNote(stringIndex, note, setup);
      if (positions.length > 0) prompts.push({ stringIndex, note, positions });
    }
  }
  return prompts;
}

/** Selection weight for a note: unseen notes sit mid-way, mastered notes keep a small floor. */
export function noteWeight(tally: NoteTally | undefined): number {
  const correct = tally?.correct ?? 0;
  const total = tally?.total ?? 0;
  const smoothedAccuracy = (correct + 1) / (total + 2);
  return (1 - smoothedAccuracy) ** 2 + 0.05;
}

/**
 * Picks a random prompt, or null if the setup has none. Never repeats `previous`
 * unless it's the only prompt the setup allows.
 */
export function generatePrompt(
  setup: PracticeSetup,
  { previous, weakNoteTallies, rng = Math.random }: GeneratePromptOptions = {},
): Prompt | null {
  const all = listPrompts(setup);
  if (all.length === 0) return null;
  const isPrevious = (p: Prompt) =>
    previous != null && p.stringIndex === previous.stringIndex && p.note === previous.note;
  const candidates = all.length > 1 ? all.filter((p) => !isPrevious(p)) : all;

  const weights = candidates.map((p) =>
    weakNoteTallies ? noteWeight(weakNoteTallies.get(p.note)) : 1,
  );
  let remaining = rng() * weights.reduce((sum, w) => sum + w, 0);
  for (let i = 0; i < candidates.length; i++) {
    remaining -= weights[i]!;
    if (remaining < 0) return candidates[i]!;
  }
  return candidates[candidates.length - 1]!;
}
