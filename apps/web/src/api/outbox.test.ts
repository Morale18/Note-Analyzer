import type { Attempt } from '@fretboard/shared';
import { DEFAULT_SETTINGS } from '@fretboard/shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from './client';
import { Outbox, type OutboxStorage, type OutboxTransport } from './outbox';

const sessionId = 'a1b2c3d4-1111-4222-8333-444455556666';

function attempt(id: string): Attempt {
  return {
    id,
    sessionId,
    stringIndex: 0,
    targetNote: 4,
    targetMidi: 40,
    playedMidi: 40,
    correct: true,
    responseTimeMs: 500,
    createdAt: 1,
  };
}

function memoryStorage(): OutboxStorage {
  const data = new Map<string, string>();
  return { getItem: (k) => data.get(k) ?? null, setItem: (k, v) => void data.set(k, v) };
}

function resolvingTransport() {
  return {
    putSettings: vi.fn(async () => undefined),
    createSession: vi.fn(async () => undefined),
    endSession: vi.fn(async () => undefined),
    postAttempts: vi.fn(async () => undefined),
  } satisfies OutboxTransport;
}

const offline = () => new ApiError(0, 'offline');

describe('Outbox', () => {
  let storage: OutboxStorage;
  let transport: ReturnType<typeof resolvingTransport>;

  beforeEach(() => {
    storage = memoryStorage();
    transport = resolvingTransport();
  });

  async function settled(outbox: Outbox) {
    await outbox.flush();
    await vi.waitFor(() => expect((outbox as unknown as { flushing: boolean }).flushing).toBe(false));
  }

  it('sends a session and attempts in order', async () => {
    const calls: string[] = [];
    transport.createSession.mockImplementation(async () => void calls.push('start'));
    transport.postAttempts.mockImplementation(async () => void calls.push('attempts'));
    const outbox = new Outbox(storage, transport);

    outbox.enqueue({ kind: 'session-start', session: { id: sessionId, startedAt: 1 } });
    outbox.enqueue({ kind: 'attempt', attempt: attempt('a') });
    await vi.waitFor(() => expect(calls).toEqual(['start', 'attempts']));
  });

  it('batches consecutive attempts queued while offline', async () => {
    transport.postAttempts.mockRejectedValue(offline());
    const outbox = new Outbox(storage, transport);
    for (const id of ['a', 'b', 'c']) {
      outbox.enqueue({ kind: 'attempt', attempt: attempt(id) });
      await settled(outbox);
    }
    transport.postAttempts.mockReset();
    transport.postAttempts.mockResolvedValue(undefined);
    await outbox.flush();

    const lastBatch = transport.postAttempts.mock.lastCall as unknown as [Attempt[]];
    expect(transport.postAttempts).toHaveBeenCalledTimes(1);
    expect(lastBatch[0].map((a) => a.id)).toEqual(['a', 'b', 'c']);
    expect(outbox.getStatus()).toEqual({ pendingAttempts: 0, unreachable: false });
  });

  it('holds attempts while unreachable and reports it', async () => {
    transport.postAttempts.mockRejectedValue(offline());
    const outbox = new Outbox(storage, transport);
    outbox.enqueue({ kind: 'attempt', attempt: attempt('a') });
    await settled(outbox);
    expect(outbox.getStatus()).toEqual({ pendingAttempts: 1, unreachable: true });
  });

  it('survives a reload', async () => {
    transport.postAttempts.mockRejectedValue(offline());
    const first = new Outbox(storage, transport);
    first.enqueue({ kind: 'attempt', attempt: attempt('a') });
    await settled(first);

    const working = resolvingTransport();
    const second = new Outbox(storage, working);
    expect(second.getStatus().pendingAttempts).toBe(1);
    await second.flush();
    expect(working.postAttempts).toHaveBeenCalledTimes(1);
    expect(second.getStatus().pendingAttempts).toBe(0);
  });

  it('retries server errors', async () => {
    transport.postAttempts.mockRejectedValueOnce(new ApiError(503, 'down'));
    const outbox = new Outbox(storage, transport);
    outbox.enqueue({ kind: 'attempt', attempt: attempt('a') });
    await settled(outbox);
    expect(outbox.getStatus().pendingAttempts).toBe(1);
    await outbox.flush();
    expect(outbox.getStatus().pendingAttempts).toBe(0);
  });

  it('drops rejected entries so the queue keeps moving', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    transport.endSession.mockRejectedValueOnce(new ApiError(404, 'gone'));
    const outbox = new Outbox(storage, transport);
    outbox.enqueue({ kind: 'session-end', id: sessionId, endedAt: 2 });
    outbox.enqueue({ kind: 'attempt', attempt: attempt('a') });
    await settled(outbox);
    expect(transport.postAttempts).toHaveBeenCalledTimes(1);
    expect(outbox.getStatus().pendingAttempts).toBe(0);
  });

  it('keeps only the latest settings', async () => {
    transport.putSettings.mockRejectedValueOnce(offline());
    const outbox = new Outbox(storage, transport);
    outbox.enqueue({ kind: 'settings', settings: { ...DEFAULT_SETTINGS, fretMax: 5 } });
    await settled(outbox);
    outbox.enqueue({ kind: 'settings', settings: { ...DEFAULT_SETTINGS, fretMax: 9 } });
    await settled(outbox);

    expect(transport.putSettings).toHaveBeenCalledTimes(2);
    expect(transport.putSettings.mock.lastCall).toEqual([{ ...DEFAULT_SETTINGS, fretMax: 9 }]);
    expect(outbox.hasPendingSettings()).toBe(false);
  });

  it('clearPractice removes practice data but keeps settings', async () => {
    transport.putSettings.mockRejectedValue(offline());
    const outbox = new Outbox(storage, transport);
    outbox.enqueue({ kind: 'settings', settings: DEFAULT_SETTINGS });
    outbox.enqueue({ kind: 'attempt', attempt: attempt('a') });
    await settled(outbox);
    outbox.clearPractice();
    expect(outbox.getStatus().pendingAttempts).toBe(0);
    expect(outbox.hasPendingSettings()).toBe(true);
  });
});
