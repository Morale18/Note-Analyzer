import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS,
  attemptSchema,
  createAttemptsSchema,
  createSessionSchema,
  sensitivityToGate,
  settingsInputSchema,
  settingsSchema,
  statsSchema,
} from './schemas';

const id = '3f2b8a52-6c1e-4b7a-9a55-2f1c7e4d9b10';
const sessionId = 'a1b2c3d4-1111-4222-8333-444455556666';
const attempt = {
  id,
  sessionId,
  stringIndex: 1,
  targetNote: 6,
  targetMidi: 54,
  playedMidi: 55,
  correct: false,
  responseTimeMs: 1234,
  createdAt: 1_700_000_000_000,
};

describe('settings schemas', () => {
  it('accepts the defaults', () => {
    expect(settingsInputSchema.safeParse(DEFAULT_SETTINGS).success).toBe(true);
    expect(settingsSchema.safeParse({ ...DEFAULT_SETTINGS, updatedAt: 1 }).success).toBe(true);
  });

  it.each([
    ['no strings', { selectedStrings: [] }],
    ['no notes', { selectedNotes: [] }],
    ['string out of range', { selectedStrings: [6] }],
    ['note out of range', { selectedNotes: [12] }],
    ['duplicate strings', { selectedStrings: [1, 1] }],
    ['inverted frets', { fretMin: 12, fretMax: 3 }],
    ['fret too high', { fretMax: 25 }],
    ['sensitivity too high', { sensitivity: 1.5 }],
    ['bad accidental style', { accidentalStyle: 'naturals' }],
  ])('rejects %s', (_name, patch) => {
    expect(settingsInputSchema.safeParse({ ...DEFAULT_SETTINGS, ...patch }).success).toBe(false);
  });

  it('gives settings saved before ear training the default ear setup', () => {
    const { ear: _ear, ...withoutEar } = DEFAULT_SETTINGS;
    expect(settingsInputSchema.parse(withoutEar).ear).toEqual(DEFAULT_SETTINGS.ear);
  });

  it('rejects an invalid ear setup', () => {
    const result = settingsInputSchema.safeParse({
      ...DEFAULT_SETTINGS,
      ear: { ...DEFAULT_SETTINGS.ear, selectedNotes: [] },
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toBe('Select at least one note.');
  });

  it('rejects a setup with no playable notes and explains why', () => {
    const result = settingsInputSchema.safeParse({
      ...DEFAULT_SETTINGS,
      selectedStrings: [0],
      selectedNotes: [4],
      fretMin: 1,
      fretMax: 2,
    });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.message).toContain('between frets 1 and 2');
  });
});

describe('sensitivityToGate', () => {
  it('lowers the gate as sensitivity rises', () => {
    expect(sensitivityToGate(0)).toBeCloseTo(0.1, 8);
    expect(sensitivityToGate(1)).toBeCloseTo(0.000316, 5);
    expect(sensitivityToGate(0.8)).toBeLessThan(sensitivityToGate(0.2));
  });
});

describe('session and attempt schemas', () => {
  it('requires a UUID session id', () => {
    expect(createSessionSchema.safeParse({ id, startedAt: 1 }).success).toBe(true);
    expect(createSessionSchema.safeParse({ id: 'nope', startedAt: 1 }).success).toBe(false);
  });

  it('validates attempts', () => {
    expect(attemptSchema.safeParse(attempt).success).toBe(true);
    expect(attemptSchema.safeParse({ ...attempt, stringIndex: 9 }).success).toBe(false);
    expect(attemptSchema.safeParse({ ...attempt, responseTimeMs: -1 }).success).toBe(false);
  });

  it('accepts a single attempt or a batch', () => {
    expect(createAttemptsSchema.safeParse(attempt).success).toBe(true);
    expect(createAttemptsSchema.safeParse({ attempts: [attempt, attempt] }).success).toBe(true);
    expect(createAttemptsSchema.safeParse({ attempts: [] }).success).toBe(false);
  });
});

describe('statsSchema', () => {
  it('parses an empty result', () => {
    const stats = {
      overall: { correct: 0, total: 0, accuracy: 0 },
      perNote: [],
      perString: [],
      recentSessions: [],
    };
    expect(statsSchema.parse(stats)).toEqual(stats);
  });
});
