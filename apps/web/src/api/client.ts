import {
  createAttemptsResponseSchema,
  sessionSchema,
  settingsSchema,
  statsSchema,
  type Attempt,
  type CreateSession,
  type Settings,
  type SettingsInput,
  type Session,
  type Stats,
} from '@fretboard/shared';
import type { z } from 'zod';

const REQUEST_TIMEOUT_MS = 5000;

export class ApiError extends Error {
  /** `status` is 0 when the server couldn't be reached at all. */
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
  }

  /** Whether trying again later could succeed. */
  get retryable(): boolean {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

async function request<S extends z.ZodType>(
  path: string,
  schema: S,
  method: string,
  body?: unknown,
): Promise<z.output<S>> {
  let response: Response;
  try {
    response = await fetch(path, {
      method,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiError(0, 'Can’t reach the server.');
  }
  if (!response.ok) throw new ApiError(response.status, `Request failed: ${response.status}`);
  return schema.parse(await response.json());
}

export const api = {
  getSettings: (): Promise<Settings> => request('/api/settings', settingsSchema, 'GET'),
  putSettings: (settings: SettingsInput): Promise<Settings> =>
    request('/api/settings', settingsSchema, 'PUT', settings),
  createSession: (session: CreateSession): Promise<Session> =>
    request('/api/sessions', sessionSchema, 'POST', session),
  endSession: (id: string, endedAt: number): Promise<Session> =>
    request(`/api/sessions/${id}`, sessionSchema, 'PATCH', { endedAt }),
  postAttempts: async (attempts: Attempt[]): Promise<void> => {
    await request('/api/attempts', createAttemptsResponseSchema, 'POST', { attempts });
  },
  getStats: (): Promise<Stats> => request('/api/stats', statsSchema, 'GET'),
  resetStats: (): Promise<Stats> => request('/api/stats', statsSchema, 'DELETE'),
};
