import { describe, expect, it } from 'vitest';
import { positionsForNote } from './fretboard';
import { gradeAttempt } from './grading';
import type { Prompt } from './prompts';

function promptFor(stringIndex: number, note: number, fretMin = 0, fretMax = 12): Prompt {
  return { stringIndex, note, positions: positionsForNote(stringIndex, note, { fretMin, fretMax }) };
}

describe('gradeAttempt', () => {
  it('accepts the exact note', () => {
    expect(gradeAttempt(promptFor(1, 6), 54)).toEqual({
      correct: true,
      playedMidi: 54,
      targetMidi: 54,
    });
  });

  it('accepts any valid position on the string', () => {
    const prompt = promptFor(0, 4);
    expect(gradeAttempt(prompt, 40).correct).toBe(true);
    expect(gradeAttempt(prompt, 52).correct).toBe(true);
  });

  it('rejects the right pitch class in the wrong octave', () => {
    expect(gradeAttempt(promptFor(1, 6), 66)).toMatchObject({ correct: false, targetMidi: 54 });
    expect(gradeAttempt(promptFor(1, 6), 42)).toMatchObject({ correct: false, targetMidi: 54 });
  });

  it('rejects positions outside the fret range', () => {
    expect(gradeAttempt(promptFor(0, 4, 1, 12), 40)).toMatchObject({
      correct: false,
      targetMidi: 52,
    });
  });

  it('reports the closest valid position when wrong', () => {
    expect(gradeAttempt(promptFor(0, 4), 42).targetMidi).toBe(40);
    expect(gradeAttempt(promptFor(0, 4), 50).targetMidi).toBe(52);
  });
});
