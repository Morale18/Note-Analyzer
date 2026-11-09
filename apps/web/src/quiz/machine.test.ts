import { positionsForNote, type Prompt } from '@fretboard/shared';
import { describe, expect, it } from 'vitest';
import { EMPTY_SCORE, initialQuizState, quizReducer, type QuizState } from './machine';

const range = { fretMin: 0, fretMax: 12 };
const fSharpOnA: Prompt = { stringIndex: 1, note: 6, positions: positionsForNote(1, 6, range) };
const cOnB: Prompt = { stringIndex: 4, note: 0, positions: positionsForNote(4, 0, range) };

const listening = quizReducer(initialQuizState, { type: 'begin', prompt: fSharpOnA, now: 1000 });

function expectPhase<P extends QuizState['phase']>(state: QuizState, phase: P) {
  expect(state.phase).toBe(phase);
  return state as Extract<QuizState, { phase: P }>;
}

describe('quizReducer', () => {
  it('begins listening with a fresh score', () => {
    const state = expectPhase(listening, 'listening');
    expect(state.prompt).toBe(fSharpOnA);
    expect(state.shownAt).toBe(1000);
    expect(state.score).toEqual(EMPTY_SCORE);
  });

  it('grades a correct note', () => {
    const state = expectPhase(
      quizReducer(listening, { type: 'note', midi: 54, now: 2500 }),
      'result',
    );
    expect(state.grade.correct).toBe(true);
    expect(state.responseTimeMs).toBe(1500);
    expect(state.score).toEqual({ correct: 1, total: 1, streak: 1, bestStreak: 1 });
  });

  it('grades a wrong note and resets the streak but not the best', () => {
    let state = quizReducer(listening, { type: 'note', midi: 54, now: 1100 });
    state = quizReducer(state, { type: 'next', prompt: cOnB, now: 1200 });
    state = quizReducer(state, { type: 'note', midi: 60, now: 1300 });
    const result = expectPhase(state, 'result');
    expect(result.grade.correct).toBe(true);
    state = quizReducer(result, { type: 'next', prompt: fSharpOnA, now: 1400 });
    state = quizReducer(state, { type: 'note', midi: 55, now: 1500 });
    expect(expectPhase(state, 'result').score).toMatchObject({
      correct: 2,
      total: 3,
      streak: 0,
      bestStreak: 2,
    });
  });

  it('ignores notes while showing a result', () => {
    const result = quizReducer(listening, { type: 'note', midi: 54, now: 1100 });
    expect(quizReducer(result, { type: 'note', midi: 55, now: 1200 })).toBe(result);
  });

  it('ignores notes while idle', () => {
    expect(quizReducer(initialQuizState, { type: 'note', midi: 54, now: 1 })).toBe(
      initialQuizState,
    );
  });

  it('advances from a result to the next prompt', () => {
    const result = quizReducer(listening, { type: 'note', midi: 54, now: 1100 });
    const next = expectPhase(
      quizReducer(result, { type: 'next', prompt: cOnB, now: 2100 }),
      'listening',
    );
    expect(next.prompt).toBe(cOnB);
    expect(next.shownAt).toBe(2100);
    expect(next.score.total).toBe(1);
  });

  it('cannot advance past a wrong note', () => {
    const wrong = quizReducer(listening, { type: 'note', midi: 55, now: 1100 });
    expect(quizReducer(wrong, { type: 'next', prompt: cOnB, now: 2100 })).toBe(wrong);
  });

  it('retries the same prompt after a wrong note and keeps the score', () => {
    const wrong = quizReducer(listening, { type: 'note', midi: 55, now: 1100 });
    const retry = expectPhase(quizReducer(wrong, { type: 'retry', now: 2100 }), 'listening');
    expect(retry.prompt).toBe(fSharpOnA);
    expect(retry.shownAt).toBe(2100);
    expect(retry.score).toMatchObject({ correct: 0, total: 1, streak: 0 });
  });

  it('advances once the retried note is correct', () => {
    let state = quizReducer(listening, { type: 'note', midi: 55, now: 1100 });
    state = quizReducer(state, { type: 'retry', now: 2100 });
    state = quizReducer(state, { type: 'note', midi: 54, now: 2500 });
    expect(expectPhase(state, 'result').score).toMatchObject({ correct: 1, total: 2, streak: 1 });
    const next = expectPhase(
      quizReducer(state, { type: 'next', prompt: cOnB, now: 3500 }),
      'listening',
    );
    expect(next.prompt).toBe(cOnB);
  });

  it('does not retry a correct note', () => {
    const correct = quizReducer(listening, { type: 'note', midi: 54, now: 1100 });
    expect(quizReducer(correct, { type: 'retry', now: 2100 })).toBe(correct);
  });

  it('can skip a prompt being retried', () => {
    let state = quizReducer(listening, { type: 'note', midi: 55, now: 1100 });
    state = quizReducer(state, { type: 'retry', now: 2100 });
    state = quizReducer(state, { type: 'skip', prompt: cOnB, now: 2200 });
    expect(expectPhase(state, 'listening').prompt).toBe(cOnB);
  });

  it('skips without scoring', () => {
    const skipped = expectPhase(
      quizReducer(listening, { type: 'skip', prompt: cOnB, now: 1500 }),
      'listening',
    );
    expect(skipped.prompt).toBe(cOnB);
    expect(skipped.score).toEqual(EMPTY_SCORE);
  });

  it('cannot skip a result', () => {
    const result = quizReducer(listening, { type: 'note', midi: 54, now: 1100 });
    expect(quizReducer(result, { type: 'skip', prompt: cOnB, now: 1200 })).toBe(result);
  });

  it('keeps the score when stopped and clears it on the next begin', () => {
    const result = quizReducer(listening, { type: 'note', midi: 54, now: 1100 });
    const stopped = expectPhase(quizReducer(result, { type: 'stop' }), 'idle');
    expect(stopped.score.total).toBe(1);
    const again = quizReducer(stopped, { type: 'begin', prompt: cOnB, now: 5000 });
    expect(again.score).toEqual(EMPTY_SCORE);
  });
});
