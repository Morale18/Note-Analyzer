import { statsSchema } from '@fretboard/shared';
import { asc, count, desc, eq, sql } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import { attempts, sessions } from '../db/schema';

const RECENT_SESSION_LIMIT = 20;

const tallyColumns = {
  correct: sql<number>`coalesce(sum(${attempts.correct}), 0)`,
  total: count(),
};

function withAccuracy<T extends { correct: number; total: number }>(row: T) {
  return { ...row, accuracy: row.total === 0 ? 0 : row.correct / row.total };
}

function readStats(db: Db) {
  const overall = db.select(tallyColumns).from(attempts).get()!;
  const perNote = db
    .select({ note: attempts.targetNote, ...tallyColumns })
    .from(attempts)
    .groupBy(attempts.targetNote)
    .orderBy(asc(attempts.targetNote))
    .all();
  const perString = db
    .select({ stringIndex: attempts.stringIndex, ...tallyColumns })
    .from(attempts)
    .groupBy(attempts.stringIndex)
    .orderBy(asc(attempts.stringIndex))
    .all();
  const recentSessions = db
    .select({
      id: sessions.id,
      startedAt: sessions.startedAt,
      endedAt: sessions.endedAt,
      ...tallyColumns,
    })
    .from(sessions)
    .innerJoin(attempts, eq(attempts.sessionId, sessions.id))
    .groupBy(sessions.id)
    .orderBy(desc(sessions.startedAt))
    .limit(RECENT_SESSION_LIMIT)
    .all();

  return {
    overall: withAccuracy(overall),
    perNote: perNote.map(withAccuracy),
    perString: perString.map(withAccuracy),
    recentSessions: recentSessions.map(withAccuracy),
  };
}

export function statsRoutes(app: FastifyInstance, db: Db): void {
  app.get('/api/stats', async () => statsSchema.parse(readStats(db)));

  app.delete('/api/stats', async () => {
    db.transaction((tx) => {
      tx.delete(attempts).run();
      tx.delete(sessions).run();
    });
    return statsSchema.parse(readStats(db));
  });
}
