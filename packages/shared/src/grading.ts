import type { Prompt } from './prompts';

export interface GradeResult {
  correct: boolean;
  playedMidi: number;
  /** The played note when correct, otherwise the closest valid position. */
  targetMidi: number;
}

/** Correct only for the exact octave of a valid position on the prompted string. */
export function gradeAttempt(prompt: Prompt, playedMidi: number): GradeResult {
  const midis = prompt.positions.map((p) => p.midi);
  if (midis.includes(playedMidi)) {
    return { correct: true, playedMidi, targetMidi: playedMidi };
  }
  const targetMidi = midis.reduce((closest, midi) =>
    Math.abs(midi - playedMidi) < Math.abs(closest - playedMidi) ? midi : closest,
  );
  return { correct: false, playedMidi, targetMidi };
}
