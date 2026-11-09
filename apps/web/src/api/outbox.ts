import {
  MAX_ATTEMPT_BATCH,
  type Attempt,
  type CreateSession,
  type SettingsInput,
} from '@fretboard/shared';
import { ApiError } from './client';

export type OutboxPayload =
  | { kind: 'settings'; settings: SettingsInput }
  | { kind: 'session-start'; session: CreateSession }
  | { kind: 'session-end'; id: string; endedAt: number }
  | { kind: 'attempt'; attempt: Attempt };

type OutboxEntry = OutboxPayload & { seq: number };

export interface OutboxTransport {
  putSettings(settings: SettingsInput): Promise<unknown>;
  createSession(session: CreateSession): Promise<unknown>;
  endSession(id: string, endedAt: number): Promise<unknown>;
  postAttempts(attempts: Attempt[]): Promise<unknown>;
}

export interface OutboxStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export interface OutboxStatus {
  pendingAttempts: number;
  unreachable: boolean;
}

const STORAGE_KEY = 'fretboard.outbox.v1';

/** A persistent, ordered queue of API writes, so practice works while the server is away. */
export class Outbox {
  private entries: OutboxEntry[] = [];
  private nextSeq = 1;
  private flushing = false;
  private status: OutboxStatus = { pendingAttempts: 0, unreachable: false };
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly storage: OutboxStorage,
    private readonly transport: OutboxTransport,
  ) {
    try {
      this.entries = JSON.parse(storage.getItem(STORAGE_KEY) ?? '[]') as OutboxEntry[];
    } catch {
      this.entries = [];
    }
    this.nextSeq = Math.max(0, ...this.entries.map((entry) => entry.seq)) + 1;
    this.updateStatus(false);
  }

  enqueue(payload: OutboxPayload): void {
    // Only the latest settings matter.
    if (payload.kind === 'settings') {
      this.entries = this.entries.filter((entry) => entry.kind !== 'settings');
    }
    this.entries.push({ ...payload, seq: this.nextSeq++ });
    this.commit();
    void this.flush();
  }

  /** Drops queued practice data, so a stats reset isn't undone by a later sync. */
  clearPractice(): void {
    this.entries = this.entries.filter((entry) => entry.kind === 'settings');
    this.commit();
  }

  hasPendingSettings(): boolean {
    return this.entries.some((entry) => entry.kind === 'settings');
  }

  /** Sends queued writes in order, stopping at the first one worth retrying later. */
  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      while (this.entries.length > 0) {
        const batch = this.nextBatch();
        try {
          await this.send(batch);
          this.remove(batch);
          this.updateStatus(false);
        } catch (error) {
          if (error instanceof ApiError && error.retryable) {
            this.updateStatus(true);
            return;
          }
          // The server rejected it, so retrying would block the queue forever.
          console.warn('Dropping rejected outbox entry', batch, error);
          this.remove(batch);
        }
      }
    } finally {
      this.flushing = false;
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getStatus = (): OutboxStatus => this.status;

  private nextBatch(): OutboxEntry[] {
    const first = this.entries[0]!;
    if (first.kind !== 'attempt') return [first];
    const batch: OutboxEntry[] = [];
    for (const entry of this.entries) {
      if (entry.kind !== 'attempt' || batch.length === MAX_ATTEMPT_BATCH) break;
      batch.push(entry);
    }
    return batch;
  }

  private send(batch: OutboxEntry[]): Promise<unknown> {
    const first = batch[0]!;
    switch (first.kind) {
      case 'settings':
        return this.transport.putSettings(first.settings);
      case 'session-start':
        return this.transport.createSession(first.session);
      case 'session-end':
        return this.transport.endSession(first.id, first.endedAt);
      case 'attempt':
        return this.transport.postAttempts(
          batch.flatMap((entry) => (entry.kind === 'attempt' ? [entry.attempt] : [])),
        );
    }
  }

  private remove(batch: OutboxEntry[]): void {
    const sent = new Set(batch.map((entry) => entry.seq));
    this.entries = this.entries.filter((entry) => !sent.has(entry.seq));
    this.commit();
  }

  private commit(): void {
    try {
      this.storage.setItem(STORAGE_KEY, JSON.stringify(this.entries));
    } catch {
      // Storage full or unavailable: the queue still works until the page closes.
    }
    this.updateStatus(this.status.unreachable);
  }

  private updateStatus(unreachable: boolean): void {
    const pendingAttempts = this.entries.filter((entry) => entry.kind === 'attempt').length;
    if (
      pendingAttempts === this.status.pendingAttempts &&
      unreachable === this.status.unreachable
    ) {
      return;
    }
    this.status = { pendingAttempts, unreachable };
    this.listeners.forEach((listener) => listener());
  }
}
