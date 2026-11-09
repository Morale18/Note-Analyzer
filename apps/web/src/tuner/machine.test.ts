import { describe, expect, it } from 'vitest';
import { initialTunerState, median, tunerReducer, type TunerState } from './machine';

const listening = tunerReducer(initialTunerState, { type: 'begin', stringCount: 6 });

function read(state: TunerState, cents: number | null, nowMs: number) {
  return tunerReducer(state, { type: 'reading', cents, nowMs });
}

/** Holds the current string in tune until it passes. */
function pass(state: TunerState): TunerState {
  return read(read(state, 0, 0), 0, 500);
}

function passAndMoveOn(state: TunerState): TunerState {
  return tunerReducer(pass(state), { type: 'next', auto: true });
}

describe('median', () => {
  it('ignores an outlier', () => {
    expect(median([1, 2, 300, 3, 2])).toBe(2);
  });

  it('averages the middle pair of an even count', () => {
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
});

describe('tunerReducer', () => {
  it('begins on the lowest string with nothing tuned', () => {
    expect(listening.phase).toBe('listening');
    expect(listening.current).toBe(0);
    expect(listening.tuned).toEqual([false, false, false, false, false, false]);
  });

  it('shows how far off the string is without passing it', () => {
    const state = read(listening, -30, 0);
    expect(state.cents).toBe(-30);
    expect(state.phase).toBe('listening');
    expect(state.heldSinceMs).toBeNull();
  });

  it('needs the hold time before a string passes', () => {
    expect(read(read(listening, 2, 0), 2, 499).phase).toBe('listening');
    expect(read(read(listening, 2, 0), 2, 500).phase).toBe('passed');
  });

  it('marks the string as tuned when it passes', () => {
    expect(pass(listening).tuned[0]).toBe(true);
  });

  it('never passes on a brief touch of the target', () => {
    const passing = read(listening, 0, 0);
    const swung = read(passing, 40, 100);
    expect(swung.heldSinceMs).toBeNull();
    expect(read(swung, 0, 600).phase).toBe('listening');
  });

  it('tolerates small wobble once holding', () => {
    expect(read(read(read(listening, 0, 0), 7, 250), 0, 500).phase).toBe('passed');
  });

  it('needs tighter tuning to start a hold than to keep one', () => {
    expect(read(listening, 7, 0).heldSinceMs).toBeNull();
  });

  it('rides out a short dropout', () => {
    const state = read(read(listening, 0, 0), null, 100);
    expect(state.heldSinceMs).toBe(0);
    expect(state.cents).toBe(0);
  });

  it('forgets the reading after a long dropout', () => {
    const state = read(read(listening, 0, 0), null, 151);
    expect(state.heldSinceMs).toBeNull();
    expect(state.cents).toBeNull();
  });

  it('ignores readings while showing a pass', () => {
    const passed = pass(listening);
    expect(read(passed, 30, 600)).toBe(passed);
  });

  it('moves from low to high and clears the old reading', () => {
    const state = passAndMoveOn(listening);
    expect(state.phase).toBe('listening');
    expect(state.current).toBe(1);
    expect(state.cents).toBeNull();
    expect(state.heldSinceMs).toBeNull();
  });

  it('completes once every string has passed', () => {
    let state = listening;
    for (let i = 0; i < 6; i++) state = passAndMoveOn(state);
    expect(state.phase).toBe('complete');
    expect(state.tuned.every(Boolean)).toBe(true);
  });

  it('wraps around to strings passed over by jumping ahead', () => {
    let state = tunerReducer(listening, { type: 'select', stringIndex: 1 });
    for (let i = 0; i < 5; i++) state = passAndMoveOn(state);
    expect(state.phase).toBe('listening');
    expect(state.current).toBe(0);
    expect(state.tuned).toEqual([false, true, true, true, true, true]);
  });

  it('stays on the string with Auto off, keeping it checked', () => {
    const state = tunerReducer(pass(listening), { type: 'next', auto: false });
    expect(state.phase).toBe('listening');
    expect(state.current).toBe(0);
    expect(state.tuned[0]).toBe(true);
    expect(state.cents).toBeNull();
  });

  it('still completes with Auto off when the last string passes', () => {
    let state = listening;
    for (let i = 0; i < 5; i++) state = passAndMoveOn(state);
    expect(tunerReducer(pass(state), { type: 'next', auto: false }).phase).toBe('complete');
  });

  it('jumps to a chosen string', () => {
    const state = tunerReducer(listening, { type: 'select', stringIndex: 4 });
    expect(state.current).toBe(4);
  });

  it('retunes a passed string when it is chosen', () => {
    const state = tunerReducer(passAndMoveOn(listening), { type: 'select', stringIndex: 0 });
    expect(state.current).toBe(0);
    expect(state.tuned[0]).toBe(false);
  });

  it('can reopen a string after completing', () => {
    let state = listening;
    for (let i = 0; i < 6; i++) state = passAndMoveOn(state);
    const reopened = tunerReducer(state, { type: 'select', stringIndex: 3 });
    expect(reopened.phase).toBe('listening');
    expect(reopened.tuned[3]).toBe(false);
    expect(reopened.tuned[2]).toBe(true);
  });

  it('ignores string selection while idle', () => {
    expect(tunerReducer(initialTunerState, { type: 'select', stringIndex: 2 })).toBe(
      initialTunerState,
    );
  });

  it('resets when stopped', () => {
    expect(tunerReducer(pass(listening), { type: 'stop' })).toBe(initialTunerState);
  });
});
