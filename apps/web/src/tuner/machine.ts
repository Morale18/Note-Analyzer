/** A string counts as in tune inside this range. */
export const IN_TUNE_CENTS = 5;
/** Once a hold has begun, wobble up to this much doesn't break it. */
const HOLD_TOLERANCE_CENTS = 8;
/** How long a string must stay in tune to pass. Long enough to outlast the sharp pluck attack. */
const HOLD_MS = 500;
/** Gaps in the reading shorter than this don't interrupt the hold. */
const MAX_DROPOUT_MS = 150;

export interface TunerState {
  /** `passed` shows a string's success briefly, before moving on. */
  phase: 'idle' | 'listening' | 'passed' | 'complete';
  current: number;
  tuned: readonly boolean[];
  /** Smoothed distance from the target; null while nothing is heard. */
  cents: number | null;
  heldSinceMs: number | null;
  lastHeardMs: number;
}

export type TunerEvent =
  | { type: 'begin'; stringCount: number }
  | { type: 'reading'; cents: number | null; nowMs: number }
  /** Ends the `passed` display. Without `auto`, the tuner stays on the same string. */
  | { type: 'next'; auto: boolean }
  | { type: 'select'; stringIndex: number }
  | { type: 'stop' };

export const initialTunerState: TunerState = {
  phase: 'idle',
  current: 0,
  tuned: [],
  cents: null,
  heldSinceMs: null,
  lastHeardMs: 0,
};

/** Middle value, which ignores the odd wild frame that an average would follow. */
export function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
}

/** The next string still to tune, wrapping around; null if there are no others. */
function nextUntuned(tuned: readonly boolean[], from: number): number | null {
  for (let step = 1; step < tuned.length; step++) {
    const index = (from + step) % tuned.length;
    if (!tuned[index]) return index;
  }
  return null;
}

function listenTo(state: TunerState, current: number, tuned = state.tuned): TunerState {
  return { ...state, phase: 'listening', current, tuned, cents: null, heldSinceMs: null };
}

function applyReading(state: TunerState, cents: number | null, nowMs: number): TunerState {
  if (cents === null) {
    if (state.cents === null || nowMs - state.lastHeardMs <= MAX_DROPOUT_MS) return state;
    return { ...state, cents: null, heldSinceMs: null };
  }

  const limit = state.heldSinceMs === null ? IN_TUNE_CENTS : HOLD_TOLERANCE_CENTS;
  const heldSinceMs = Math.abs(cents) <= limit ? (state.heldSinceMs ?? nowMs) : null;
  const heard = { ...state, cents, heldSinceMs, lastHeardMs: nowMs };
  if (heldSinceMs === null || nowMs - heldSinceMs < HOLD_MS) return heard;
  return {
    ...heard,
    phase: 'passed',
    tuned: state.tuned.map((tuned, index) => tuned || index === state.current),
  };
}

/** Pure tuner transitions. Events that don't apply to the current phase are ignored. */
export function tunerReducer(state: TunerState, event: TunerEvent): TunerState {
  switch (event.type) {
    case 'begin':
      return listenTo(state, 0, new Array<boolean>(event.stringCount).fill(false));

    case 'reading':
      return state.phase === 'listening' ? applyReading(state, event.cents, event.nowMs) : state;

    case 'next': {
      if (state.phase !== 'passed') return state;
      const next = nextUntuned(state.tuned, state.current);
      if (next === null) return { ...state, phase: 'complete' };
      return listenTo(state, event.auto ? next : state.current);
    }

    case 'select':
      if (state.phase === 'idle') return state;
      return listenTo(
        state,
        event.stringIndex,
        state.tuned.map((tuned, index) => tuned && index !== event.stringIndex),
      );

    case 'stop':
      return initialTunerState;
  }
}
