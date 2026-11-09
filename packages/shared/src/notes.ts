export type AccidentalStyle = 'sharps' | 'flats';

/** A4 reference pitch in Hz. */
export const A4_FREQUENCY = 440;
export const A4_MIDI = 69;

const SHARP_NAMES = ['C', 'C♯', 'D', 'D♯', 'E', 'F', 'F♯', 'G', 'G♯', 'A', 'A♯', 'B'] as const;
const FLAT_NAMES = ['C', 'D♭', 'D', 'E♭', 'E', 'F', 'G♭', 'G', 'A♭', 'A', 'B♭', 'B'] as const;

/** Pitch classes (C = 0) of the seven natural notes. */
export const NATURAL_NOTES: readonly number[] = [0, 2, 4, 5, 7, 9, 11];
export const ALL_NOTES: readonly number[] = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11];

/** Fractional MIDI number for a frequency. */
export function frequencyToMidiFloat(frequency: number): number {
  return A4_MIDI + 12 * Math.log2(frequency / A4_FREQUENCY);
}

/** Nearest MIDI note for a frequency. */
export function frequencyToMidi(frequency: number): number {
  return Math.round(frequencyToMidiFloat(frequency));
}

export function midiToFrequency(midi: number): number {
  return A4_FREQUENCY * 2 ** ((midi - A4_MIDI) / 12);
}

/** Cents from `midi` (by default the nearest note) to `frequency`. */
export function centsOffset(frequency: number, midi: number = frequencyToMidi(frequency)): number {
  return 1200 * Math.log2(frequency / midiToFrequency(midi));
}

/** Pitch class of a MIDI note, C = 0. */
export function midiToPitchClass(midi: number): number {
  return ((midi % 12) + 12) % 12;
}

export function pitchClassName(pitchClass: number, style: AccidentalStyle = 'sharps'): string {
  const names = style === 'flats' ? FLAT_NAMES : SHARP_NAMES;
  return names[midiToPitchClass(pitchClass)];
}

/** Scientific pitch octave, e.g. MIDI 66 → 4. */
export function midiOctave(midi: number): number {
  return Math.floor(midi / 12) - 1;
}

/** Scientific pitch name, e.g. MIDI 66 → "F♯4". */
export function midiToNoteName(midi: number, style: AccidentalStyle = 'sharps'): string {
  return `${pitchClassName(midi, style)}${midiOctave(midi)}`;
}
