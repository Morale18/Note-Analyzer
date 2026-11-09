import type { EarQuestion } from '@fretboard/shared';
import { EMPTY_SCORE, applyGrade, type Score } from '../quiz/machine';

export type EarState =
  | { phase: 'idle'; score: Score }
  | { phase: 'asking'; question: EarQuestion; score: Score }
  | { phase: 'result'; question: EarQuestion; picked: number; correct: boolean; score: Score };

export type EarEvent =
  | { type: 'begin'; question: EarQuestion }
  | { type: 'answer'; note: number }
  | { type: 'next'; question: EarQuestion }
  | { type: 'stop' };

export const initialEarState: EarState = { phase: 'idle', score: EMPTY_SCORE };

/** Pure ear training transitions. Events that don't apply to the current phase are ignored. */
export function earReducer(state: EarState, event: EarEvent): EarState {
  switch (event.type) {
    case 'begin':
      return { phase: 'asking', question: event.question, score: EMPTY_SCORE };

    case 'answer': {
      if (state.phase !== 'asking') return state;
      const correct = event.note === state.question.note;
      return {
        phase: 'result',
        question: state.question,
        picked: event.note,
        correct,
        score: applyGrade(state.score, correct),
      };
    }

    case 'next':
      // Right or wrong, every answer moves on to a new note.
      if (state.phase !== 'result') return state;
      return { phase: 'asking', question: event.question, score: state.score };

    case 'stop':
      return { phase: 'idle', score: state.score };
  }
}
