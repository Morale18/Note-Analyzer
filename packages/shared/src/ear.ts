import type { PracticeSetup } from './fretboard';
import { ALL_NOTES } from './notes';
import { listPrompts } from './prompts';

/** How many answers each ear training question offers. */
export const EAR_OPTION_COUNT = 3;

export interface EarQuestion {
  /** Pitch class of the note being played, C = 0. */
  note: number;
  /** The exact pitch to play, somewhere the setup allows on the fretboard. */
  midi: number;
  /** Pitch classes to choose from in chromatic order; always includes `note`. */
  options: number[];
}

export interface GenerateEarQuestionOptions {
  previousNote?: number | null;
  rng?: () => number;
}

/** Removes up to `count` random items from a copy of `items`. */
function takeRandom<T>(items: readonly T[], count: number, rng: () => number): T[] {
  const pool = [...items];
  const taken: T[] = [];
  while (taken.length < count && pool.length > 0) {
    taken.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  }
  return taken;
}

/** Pitch classes the setup can actually produce, in chromatic order. */
export function listEarNotes(setup: PracticeSetup): number[] {
  return [...new Set(listPrompts(setup).map((p) => p.note))].sort((a, b) => a - b);
}

/**
 * Picks a random question, or null if the setup has no notes. Never repeats
 * `previousNote` unless it's the only note the setup allows. Wrong answers come
 * from the setup's notes first, and from the rest of the 12 only if it has too few.
 */
export function generateEarQuestion(
  setup: PracticeSetup,
  { previousNote, rng = Math.random }: GenerateEarQuestionOptions = {},
): EarQuestion | null {
  const prompts = listPrompts(setup);
  const notes = listEarNotes(setup);
  if (notes.length === 0) return null;

  const candidates = notes.length > 1 ? notes.filter((n) => n !== previousNote) : notes;
  const note = takeRandom(candidates, 1, rng)[0]!;
  const pitches = new Set(
    prompts.filter((p) => p.note === note).flatMap((p) => p.positions.map((pos) => pos.midi)),
  );
  const midi = takeRandom([...pitches], 1, rng)[0]!;

  const wrongCount = EAR_OPTION_COUNT - 1;
  const wrong = takeRandom(
    notes.filter((n) => n !== note),
    wrongCount,
    rng,
  );
  const outsideSetup = ALL_NOTES.filter((n) => !notes.includes(n));
  wrong.push(...takeRandom(outsideSetup, wrongCount - wrong.length, rng));

  return { note, midi, options: [note, ...wrong].sort((a, b) => a - b) };
}
