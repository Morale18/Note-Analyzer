import { randomUUID } from 'node:crypto';
import { DEFAULT_SETTINGS, statsSchema, type Attempt, type Stats } from '@fretboard/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from './app';
import { openDb } from './db/client';

let app: FastifyInstance;
let close: () => void;

beforeEach(() => {
  const opened = openDb(':memory:');
  close = opened.close;
  app = buildApp(opened.db);
});

afterEach(async () => {
  await app.close();
  close();
});

async function createSession(id = randomUUID(), startedAt = 1000) {
  const response = await app.inject({
    method: 'POST',
    url: '/api/sessions',
    payload: { id, startedAt },
  });
  expect(response.statusCode).toBe(201);
  return id;
}

function attempt(sessionId: string, patch: Partial<Attempt> = {}): Attempt {
  return {
    id: randomUUID(),
    sessionId,
    stringIndex: 1,
    targetNote: 6,
    targetMidi: 54,
    playedMidi: 54,
    correct: true,
    responseTimeMs: 900,
    createdAt: 2000,
    ...patch,
  };
}

function postAttempts(payload: object) {
  return app.inject({ method: 'POST', url: '/api/attempts', payload });
}

async function getStats(): Promise<Stats> {
  const response = await app.inject({ method: 'GET', url: '/api/stats' });
  expect(response.statusCode).toBe(200);
  return statsSchema.parse(response.json());
}

describe('settings', () => {
  it('returns defaults before anything is saved', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...DEFAULT_SETTINGS, updatedAt: 0 });
  });

  it('saves and overwrites the single row', async () => {
    const first = { ...DEFAULT_SETTINGS, fretMax: 5, selectedStrings: [0, 1] };
    await app.inject({ method: 'PUT', url: '/api/settings', payload: first });
    const second = { ...first, accidentalStyle: 'flats', weightWeakNotes: true };
    const put = await app.inject({ method: 'PUT', url: '/api/settings', payload: second });
    expect(put.statusCode).toBe(200);

    const got = (await app.inject({ method: 'GET', url: '/api/settings' })).json();
    expect(got).toMatchObject(second);
    expect(got.updatedAt).toBeGreaterThan(0);
  });

  it('saves the ear setup separately from the practice setup', async () => {
    const ear = { ...DEFAULT_SETTINGS.ear, selectedNotes: [9], fretMax: 5 };
    const payload = { ...DEFAULT_SETTINGS, ear };
    await app.inject({ method: 'PUT', url: '/api/settings', payload });

    const got = (await app.inject({ method: 'GET', url: '/api/settings' })).json();
    expect(got.ear).toEqual(ear);
    expect(got.selectedNotes).toEqual(DEFAULT_SETTINGS.selectedNotes);
    expect(got.fretMax).toBe(DEFAULT_SETTINGS.fretMax);
  });

  it('rejects an invalid setup with a useful message', async () => {
    const response = await app.inject({
      method: 'PUT',
      url: '/api/settings',
      payload: { ...DEFAULT_SETTINGS, selectedNotes: [] },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().issues[0].message).toBe('Select at least one note.');
  });
});

describe('sessions', () => {
  it('creates idempotently', async () => {
    const id = randomUUID();
    await createSession(id, 1000);
    const repeat = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { id, startedAt: 5555 },
    });
    expect(repeat.json()).toEqual({ id, startedAt: 1000, endedAt: null });
  });

  it('ends a session', async () => {
    const id = await createSession();
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${id}`,
      payload: { endedAt: 9000 },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().endedAt).toBe(9000);
  });

  it('404s for an unknown session', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: `/api/sessions/${randomUUID()}`,
      payload: { endedAt: 9000 },
    });
    expect(response.statusCode).toBe(404);
  });

  it('400s for a malformed id', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/sessions/nope',
      payload: { endedAt: 9000 },
    });
    expect(response.statusCode).toBe(400);
  });
});

describe('attempts', () => {
  it('accepts a single attempt', async () => {
    const sessionId = await createSession();
    const response = await postAttempts(attempt(sessionId));
    expect(response.statusCode).toBe(201);
    expect(response.json()).toEqual({ inserted: 1 });
  });

  it('accepts a batch', async () => {
    const sessionId = await createSession();
    const response = await postAttempts({
      attempts: [attempt(sessionId), attempt(sessionId), attempt(sessionId)],
    });
    expect(response.json()).toEqual({ inserted: 3 });
  });

  it('ignores retried attempts', async () => {
    const sessionId = await createSession();
    const one = attempt(sessionId);
    await postAttempts({ attempts: [one] });
    const retry = await postAttempts({ attempts: [one, attempt(sessionId)] });
    expect(retry.json()).toEqual({ inserted: 1 });
    expect((await getStats()).overall.total).toBe(2);
  });

  it('accepts attempts whose session no longer exists', async () => {
    const response = await postAttempts(attempt(randomUUID()));
    expect(response.statusCode).toBe(201);
    expect((await getStats()).recentSessions).toHaveLength(1);
  });

  it('rejects invalid attempts', async () => {
    const response = await postAttempts({ ...attempt(randomUUID()), stringIndex: 7 });
    expect(response.statusCode).toBe(400);
  });
});

describe('stats', () => {
  it('is empty with no attempts', async () => {
    expect(await getStats()).toEqual({
      overall: { correct: 0, total: 0, accuracy: 0 },
      perNote: [],
      perString: [],
      recentSessions: [],
    });
  });

  it('aggregates per note, per string and per session', async () => {
    const older = await createSession(randomUUID(), 1000);
    const newer = await createSession(randomUUID(), 2000);
    await postAttempts({
      attempts: [
        attempt(older, { targetNote: 6, stringIndex: 1, correct: true }),
        attempt(older, { targetNote: 6, stringIndex: 1, correct: false }),
        attempt(newer, { targetNote: 0, stringIndex: 4, correct: true }),
        attempt(newer, { targetNote: 6, stringIndex: 4, correct: true }),
      ],
    });

    const stats = await getStats();
    expect(stats.overall).toEqual({ correct: 3, total: 4, accuracy: 0.75 });
    expect(stats.perNote).toEqual([
      { note: 0, correct: 1, total: 1, accuracy: 1 },
      { note: 6, correct: 2, total: 3, accuracy: 2 / 3 },
    ]);
    expect(stats.perString).toEqual([
      { stringIndex: 1, correct: 1, total: 2, accuracy: 0.5 },
      { stringIndex: 4, correct: 2, total: 2, accuracy: 1 },
    ]);
    expect(stats.recentSessions.map((s) => [s.id, s.correct, s.total])).toEqual([
      [newer, 2, 2],
      [older, 1, 2],
    ]);
  });

  it('leaves out sessions with no attempts', async () => {
    await createSession();
    expect((await getStats()).recentSessions).toEqual([]);
  });

  it('resets attempts and sessions but keeps settings', async () => {
    const payload = { ...DEFAULT_SETTINGS, fretMax: 7 };
    await app.inject({ method: 'PUT', url: '/api/settings', payload });
    await postAttempts(attempt(await createSession()));

    const response = await app.inject({ method: 'DELETE', url: '/api/stats' });
    expect(response.statusCode).toBe(200);
    expect((await getStats()).overall.total).toBe(0);
    const settings = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(settings.json().fretMax).toBe(7);
  });
});
