import { STANDARD_TUNING } from './fretboard';
import { centsOffset } from './notes';

export interface Tuning {
  id: string;
  name: string;
  /** Open-string MIDI notes, index 0 = lowest string. */
  strings: readonly number[];
}

export const TUNINGS: readonly Tuning[] = [
  { id: 'standard', name: 'Standard', strings: STANDARD_TUNING },
  { id: 'drop-d', name: 'Drop D', strings: [38, 45, 50, 55, 59, 64] },
  { id: 'half-step-down', name: 'Half step down', strings: [39, 44, 49, 54, 58, 63] },
  { id: 'drop-c-sharp', name: 'Drop C♯', strings: [37, 44, 49, 54, 58, 63] },
  { id: 'whole-step-down', name: 'Whole step down', strings: [38, 43, 48, 53, 57, 62] },
  { id: 'drop-c', name: 'Drop C', strings: [36, 43, 48, 53, 57, 62] },
  { id: 'dadgad', name: 'DADGAD', strings: [38, 45, 50, 55, 57, 62] },
  { id: 'open-g', name: 'Open G', strings: [38, 43, 50, 55, 59, 62] },
  { id: 'open-d', name: 'Open D', strings: [38, 45, 50, 54, 57, 62] },
  { id: 'open-a', name: 'Open A', strings: [40, 45, 52, 57, 61, 64] },
  { id: 'open-e', name: 'Open E', strings: [40, 47, 52, 56, 59, 64] },
  { id: 'open-c', name: 'Open C', strings: [36, 43, 48, 55, 60, 64] },
];

/** The tuning with this id, or standard if it's unknown. */
export function findTuning(id: string | null): Tuning {
  return TUNINGS.find((tuning) => tuning.id === id) ?? TUNINGS[0];
}

/** Half an octave either way, so a badly slack string still gets a direction. */
const MAX_STRING_OFFSET_CENTS = 600;
/** Below D3, phone mics can lose the fundamental and read a string an octave high. */
const OCTAVE_FOLD_BELOW_MIDI = 50;

/** Cents from the target note to `frequency`, or null if it's too far off to be that string. */
export function stringOffsetCents(frequency: number, targetMidi: number): number | null {
  const direct = centsOffset(frequency, targetMidi);
  const cents =
    targetMidi < OCTAVE_FOLD_BELOW_MIDI && direct > MAX_STRING_OFFSET_CENTS ? direct - 1200 : direct;
  return Math.abs(cents) <= MAX_STRING_OFFSET_CENTS ? cents : null;
}
