export interface StabilizerFrame {
  timeMs: number;
  rms: number;
  /** Nearest MIDI note, or null when no pitch was found. */
  midi: number | null;
  clarity: number;
}

export interface StabilizerOptions {
  /** RMS below this counts as silence. */
  gateRms: number;
  minClarity?: number;
  /** How long one note must persist before it's emitted. */
  holdMs?: number;
  /** While locked, RMS rising by this factor over its recent low counts as a new attack. */
  attackRatio?: number;
  /** Unclear frames shorter than this don't interrupt a candidate note. */
  maxDropoutMs?: number;
}

export type StabilizerState = 'listening' | 'locked';

interface Candidate {
  midi: number;
  startMs: number;
  lastSeenMs: number;
}

/**
 * Turns noisy per-frame pitches into single note events. Each emitted note locks the
 * stabilizer, so the note's ring-out can't be graded again; it unlocks when the signal
 * falls below the gate or a new attack arrives.
 */
export class NoteStabilizer {
  private gateRms: number;
  private readonly minClarity: number;
  private readonly holdMs: number;
  private readonly attackRatio: number;
  private readonly maxDropoutMs: number;

  private current: StabilizerState = 'listening';
  private candidate: Candidate | null = null;
  private lockedLowRms = Infinity;

  constructor(options: StabilizerOptions) {
    this.gateRms = options.gateRms;
    this.minClarity = options.minClarity ?? 0.9;
    this.holdMs = options.holdMs ?? 120;
    this.attackRatio = options.attackRatio ?? 1.8;
    this.maxDropoutMs = options.maxDropoutMs ?? 50;
  }

  get state(): StabilizerState {
    return this.current;
  }

  setGate(gateRms: number): void {
    this.gateRms = gateRms;
  }

  /** Ignores input until silence or a new attack, e.g. when a new prompt appears. */
  lock(): void {
    this.current = 'locked';
    this.candidate = null;
    this.lockedLowRms = Infinity;
  }

  reset(): void {
    this.current = 'listening';
    this.candidate = null;
    this.lockedLowRms = Infinity;
  }

  /** Feeds one frame; returns a MIDI note when one has just stabilized. */
  push(frame: StabilizerFrame): number | null {
    if (frame.rms < this.gateRms) {
      this.reset();
      return null;
    }

    if (this.current === 'locked') {
      if (frame.rms < this.lockedLowRms * this.attackRatio) {
        this.lockedLowRms = Math.min(this.lockedLowRms, frame.rms);
        return null;
      }
      this.reset();
    }

    return this.track(frame);
  }

  private track(frame: StabilizerFrame): number | null {
    const { midi, timeMs } = frame;
    if (midi === null || frame.clarity < this.minClarity) {
      if (this.candidate && timeMs - this.candidate.lastSeenMs > this.maxDropoutMs) {
        this.candidate = null;
      }
      return null;
    }

    if (this.candidate?.midi !== midi) {
      this.candidate = { midi, startMs: timeMs, lastSeenMs: timeMs };
      return null;
    }

    this.candidate.lastSeenMs = timeMs;
    if (timeMs - this.candidate.startMs < this.holdMs) return null;

    this.lock();
    this.lockedLowRms = frame.rms;
    return midi;
  }
}
