import { createAttemptsResponseSchema, createAttemptsSchema } from '@fretboard/shared';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import { attempts, sessions } from '../db/schema';
import { parseRequest } from './validation';

export function attemptRoutes(app: FastifyInstance, db: Db): void {
  app.post('/api/attempts', async (request, reply) => {
    const body = parseRequest(createAttemptsSchema, request.body);
    const rows = 'attempts' in body ? body.attempts : [body];

    // A queued attempt can outlive its session if stats were reset in the meantime.
    const sessionStarts = new Map<string, number>();
    for (const { sessionId, createdAt } of rows) {
      sessionStarts.set(sessionId, Math.min(createdAt, sessionStarts.get(sessionId) ?? Infinity));
    }

    // Ignoring duplicate ids makes retried uploads safe.
    const inserted = db.transaction((tx) => {
      for (const [id, startedAt] of sessionStarts) {
        tx.insert(sessions).values({ id, startedAt }).onConflictDoNothing().run();
      }
      return tx.insert(attempts).values(rows).onConflictDoNothing().run().changes;
    });

    return reply.status(201).send(createAttemptsResponseSchema.parse({ inserted }));
  });
}
