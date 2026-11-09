import {
  createSessionSchema,
  endSessionSchema,
  sessionParamsSchema,
  sessionSchema,
} from '@fretboard/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import { sessions } from '../db/schema';
import { parseRequest } from './validation';

export function sessionRoutes(app: FastifyInstance, db: Db): void {
  // Clients generate ids so they can start sessions offline; repeats are harmless.
  app.post('/api/sessions', async (request, reply) => {
    const body = parseRequest(createSessionSchema, request.body);
    db.insert(sessions).values(body).onConflictDoNothing().run();
    const row = db.select().from(sessions).where(eq(sessions.id, body.id)).get();
    return reply.status(201).send(sessionSchema.parse(row));
  });

  app.patch('/api/sessions/:id', async (request, reply) => {
    const { id } = parseRequest(sessionParamsSchema, request.params);
    const { endedAt } = parseRequest(endSessionSchema, request.body);
    const row = db.update(sessions).set({ endedAt }).where(eq(sessions.id, id)).returning().get();
    if (!row) return reply.status(404).send({ error: 'Session not found' });
    return sessionSchema.parse(row);
  });
}
