import type { EarQuestion } from '@fretboard/shared';
import { describe, expect, it } from 'vitest';
import { EMPTY_SCORE } from '../quiz/machine';
import { earReducer, initialEarState, type EarState } from './machine';

const a: EarQuestion = { note: 9, midi: 57, options: [0, 4, 9] };
const c: EarQuestion = { note: 0, midi: 60, options: [0, 5, 7] };

const asking = earReducer(initialEarState, { type: 'begin', question: a });

function expectPhase<P extends EarState['phase']>(state: EarState, phase: P) {
  expect(state.phase).toBe(phase);
  return state as Extract<EarState, { phase: P }>;
}

describe('earReducer', () => {
  it('begins asking with a fresh score', () => {
    const state = expectPhase(asking, 'asking');
    expect(state.question).toBe(a);
    expect(state.score).toEqual(EMPTY_SCORE);
  });

  it('scores a correct answer', () => {
    const state = expectPhase(earReducer(asking, { type: 'answer', note: 9 }), 'result');
    expect(state.correct).toBe(true);
    expect(state.score).toEqual({ correct: 1, total: 1, streak: 1, bestStreak: 1 });
  });

  it('scores a wrong answer and remembers what was picked', () => {
    const state = expectPhase(earReducer(asking, { type: 'answer', note: 4 }), 'result');
    expect(state.correct).toBe(false);
    expect(state.picked).toBe(4);
    expect(state.score).toEqual({ correct: 0, total: 1, streak: 0, bestStreak: 0 });
  });

  it('moves to the next note after a wrong answer', () => {
    const wrong = earReducer(asking, { type: 'answer', note: 4 });
    const state = expectPhase(earReducer(wrong, { type: 'next', question: c }), 'asking');
    expect(state.question).toBe(c);
    expect(state.score.total).toBe(1);
  });

  it('counts only the first answer to a question', () => {
    const answered = earReducer(asking, { type: 'answer', note: 4 });
    expect(earReducer(answered, { type: 'answer', note: 9 })).toBe(answered);
  });

  it('ignores next while a question is unanswered', () => {
    expect(earReducer(asking, { type: 'next', question: c })).toBe(asking);
  });

  it('keeps the score when stopped', () => {
    const answered = earReducer(asking, { type: 'answer', note: 9 });
    const state = expectPhase(earReducer(answered, { type: 'stop' }), 'idle');
    expect(state.score.correct).toBe(1);
  });
});
