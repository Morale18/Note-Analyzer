import { midiToPitchClass } from './notes';

/** Open-string MIDI notes, index 0 = low E, index 5 = high E. */
export const STANDARD_TUNING: readonly number[] = [40, 45, 50, 55, 59, 64];
export const STRING_LABELS: readonly string[] = ['low E', 'A', 'D', 'G', 'B', 'high E'];
export const ALL_STRINGS: readonly number[] = [0, 1, 2, 3, 4, 5];
export const MAX_FRET = 24;

export interface FretPosition {
  fret: number;
  midi: number;
}

export interface FretRange {
  fretMin: number;
  fretMax: number;
}

/** Every fret in the range where `stringIndex` sounds `pitchClass`, lowest first. */
export function positionsForNote(
  stringIndex: number,
  pitchClass: number,
  { fretMin, fretMax }: FretRange,
): FretPosition[] {
  const open = STANDARD_TUNING[stringIndex];
  if (open === undefined) return [];
  const positions: FretPosition[] = [];
  for (let fret = fretMin; fret <= fretMax; fret++) {
    if (midiToPitchClass(open + fret) === pitchClass) {
      positions.push({ fret, midi: open + fret });
    }
  }
  return positions;
}

export interface PracticeSetup extends FretRange {
  selectedStrings: readonly number[];
  selectedNotes: readonly number[];
}

/** Human-readable reasons a setup can't be practiced; empty when it can. */
export function validateSetup(setup: PracticeSetup): string[] {
  const { selectedStrings, selectedNotes, fretMin, fretMax } = setup;
  const errors: string[] = [];
  if (selectedStrings.length === 0) errors.push('Select at least one string.');
  if (selectedNotes.length === 0) errors.push('Select at least one note.');
  if (fretMin > fretMax) errors.push('The lowest fret can’t be above the highest fret.');
  if (errors.length > 0) return errors;

  const anyPosition = selectedStrings.some((stringIndex) =>
    selectedNotes.some((note) => positionsForNote(stringIndex, note, setup).length > 0),
  );
  if (!anyPosition) {
    errors.push(
      `None of the selected notes exist on the selected strings between frets ${fretMin} and ${fretMax}. Widen the fret range or add more notes.`,
    );
  }
  return errors;
}
