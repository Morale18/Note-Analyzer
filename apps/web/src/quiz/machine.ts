import { gradeAttempt, type GradeResult, type Prompt } from '@fretboard/shared';

export interface Score {
  correct: number;
  total: number;
  streak: number;
  bestStreak: number;
}

export const EMPTY_SCORE: Score = { correct: 0, total: 0, streak: 0, bestStreak: 0 };

export type QuizState =
  | { phase: 'idle'; score: Score }
  | { phase: 'listening'; prompt: Prompt; shownAt: number; score: Score }
  | {
      phase: 'result';
      prompt: Prompt;
      grade: GradeResult;
      responseTimeMs: number;
      score: Score;
    };

export type QuizEvent =
  | { type: 'begin'; prompt: Prompt; now: number }
  | { type: 'note'; midi: number; now: number }
  | { type: 'next'; prompt: Prompt; now: number }
  | { type: 'retry'; now: number }
  | { type: 'skip'; prompt: Prompt; now: number }
  | { type: 'stop' };

export const initialQuizState: QuizState = { phase: 'idle', score: EMPTY_SCORE };

export function accuracyText(score: Score): string {
  return score.total === 0 ? '—' : `${Math.round((score.correct / score.total) * 100)}%`;
}

export function applyGrade(score: Score, correct: boolean): Score {
  const streak = correct ? score.streak + 1 : 0;
  return {
    correct: score.correct + (correct ? 1 : 0),
    total: score.total + 1,
    streak,
    bestStreak: Math.max(score.bestStreak, streak),
  };
}

/** Pure quiz transitions. Events that don't apply to the current phase are ignored. */
export function quizReducer(state: QuizState, event: QuizEvent): QuizState {
  switch (event.type) {
    case 'begin':
      return { phase: 'listening', prompt: event.prompt, shownAt: event.now, score: EMPTY_SCORE };

    case 'note': {
      if (state.phase !== 'listening') return state;
      const grade = gradeAttempt(state.prompt, event.midi);
      return {
        phase: 'result',
        prompt: state.prompt,
        grade,
        responseTimeMs: Math.max(0, Math.round(event.now - state.shownAt)),
        score: applyGrade(state.score, grade.correct),
      };
    }

    case 'next':
      // A wrong note keeps the prompt until it's played correctly or skipped.
      if (state.phase !== 'result' || !state.grade.correct) return state;
      return { phase: 'listening', prompt: event.prompt, shownAt: event.now, score: state.score };

    case 'retry':
      if (state.phase !== 'result' || state.grade.correct) return state;
      return { phase: 'listening', prompt: state.prompt, shownAt: event.now, score: state.score };

    case 'skip':
      if (state.phase !== 'listening') return state;
      return { phase: 'listening', prompt: event.prompt, shownAt: event.now, score: state.score };

    case 'stop':
      return { phase: 'idle', score: state.score };
  }
}
