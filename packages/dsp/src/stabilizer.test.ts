import { beforeEach, describe, expect, it } from 'vitest';
import { NoteStabilizer, type StabilizerFrame } from './stabilizer';

const HOP_MS = 20;
const GATE = 0.01;

describe('NoteStabilizer', () => {
  let stabilizer: NoteStabilizer;
  let now: number;

  beforeEach(() => {
    stabilizer = new NoteStabilizer({ gateRms: GATE });
    now = 0;
  });

  function push(frame: Partial<StabilizerFrame> = {}) {
    const result = stabilizer.push({ timeMs: now, rms: 0.1, midi: 40, clarity: 0.98, ...frame });
    now += HOP_MS;
    return result;
  }

  function pushMany(count: number, frame: Partial<StabilizerFrame> = {}) {
    const emitted: number[] = [];
    for (let i = 0; i < count; i++) {
      const note = push(frame);
      if (note !== null) emitted.push(note);
    }
    return emitted;
  }

  /** Plays a note until it's emitted, leaving the stabilizer locked. */
  function playToEmission(midi = 40) {
    expect(pushMany(7, { midi })).toEqual([midi]);
    expect(stabilizer.state).toBe('locked');
  }

  it('does not emit before the hold time', () => {
    expect(pushMany(6)).toEqual([]);
  });

  it('emits once the same note has held for ~120 ms', () => {
    pushMany(6);
    expect(push()).toBe(40);
  });

  it('emits only once for a sustained note', () => {
    expect(pushMany(100, { rms: 0.1 })).toEqual([40]);
  });

  it('restarts the hold when the note changes', () => {
    pushMany(5, { midi: 40 });
    expect(pushMany(6, { midi: 41 })).toEqual([]);
    expect(push({ midi: 41 })).toBe(41);
  });

  it('ignores low-clarity frames', () => {
    expect(pushMany(50, { clarity: 0.5 })).toEqual([]);
  });

  it('ignores frames with no pitch', () => {
    expect(pushMany(50, { midi: null, clarity: 0 })).toEqual([]);
  });

  it('ignores frames below the gate', () => {
    expect(pushMany(50, { rms: GATE / 2 })).toEqual([]);
  });

  it('tolerates a single unclear frame', () => {
    pushMany(3);
    push({ clarity: 0.2 });
    expect(pushMany(3)).toEqual([40]);
  });

  it('restarts after a longer dropout', () => {
    pushMany(3);
    pushMany(4, { clarity: 0.2 });
    expect(pushMany(6)).toEqual([]);
  });

  it('restarts when the signal falls below the gate', () => {
    pushMany(5);
    push({ rms: 0 });
    expect(pushMany(6)).toEqual([]);
  });

  describe('after emitting', () => {
    beforeEach(() => playToEmission());

    it('ignores the ring-out of a decaying note', () => {
      for (let i = 0; i < 100; i++) {
        expect(push({ rms: 0.1 * Math.exp(-i / 60), midi: 40 })).toBeNull();
      }
      expect(stabilizer.state).toBe('locked');
    });

    it('ignores a different pitch while the level keeps decaying', () => {
      for (let i = 0; i < 20; i++) {
        expect(push({ rms: 0.1 * Math.exp(-i / 60), midi: 52 })).toBeNull();
      }
    });

    it('rearms once the signal drops below the gate', () => {
      push({ rms: GATE / 2 });
      expect(stabilizer.state).toBe('listening');
      expect(pushMany(7, { midi: 45 })).toEqual([45]);
    });

    it('rearms on a new attack over the ring-out', () => {
      pushMany(20, { rms: 0.03 });
      expect(pushMany(8, { rms: 0.2, midi: 45 })).toEqual([45]);
    });

    it('can re-emit the same note on a new attack', () => {
      pushMany(20, { rms: 0.03 });
      expect(pushMany(8, { rms: 0.2, midi: 40 })).toEqual([40]);
    });

    it('does not treat small level fluctuations as an attack', () => {
      for (let i = 0; i < 50; i++) {
        expect(push({ rms: i % 2 === 0 ? 0.05 : 0.07 })).toBeNull();
      }
    });
  });

  describe('lock()', () => {
    it('ignores a ringing note when a new prompt appears', () => {
      pushMany(3);
      stabilizer.lock();
      expect(pushMany(50, { rms: 0.1 })).toEqual([]);
    });

    it('releases on the next frame below the gate', () => {
      stabilizer.lock();
      push({ rms: 0 });
      expect(stabilizer.state).toBe('listening');
    });

    it('releases on a new attack', () => {
      stabilizer.lock();
      push({ rms: 0.02 });
      expect(pushMany(8, { rms: 0.1, midi: 47 })).toEqual([47]);
    });
  });

  it('respects a changed gate', () => {
    stabilizer.setGate(0.2);
    expect(pushMany(20, { rms: 0.1 })).toEqual([]);
    stabilizer.setGate(0.05);
    expect(pushMany(7, { rms: 0.1 })).toEqual([40]);
  });

  it('reset() clears a lock', () => {
    playToEmission();
    stabilizer.reset();
    expect(stabilizer.state).toBe('listening');
    expect(pushMany(7, { midi: 50 })).toEqual([50]);
  });
});
