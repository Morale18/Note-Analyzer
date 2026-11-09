import { DEFAULT_SETTINGS, settingsInputSchema, settingsSchema } from '@fretboard/shared';
import { eq } from 'drizzle-orm';
import type { FastifyInstance } from 'fastify';
import type { Db } from '../db/client';
import { settings } from '../db/schema';
import { parseRequest } from './validation';

const SETTINGS_ID = 1;

export function settingsRoutes(app: FastifyInstance, db: Db): void {
  app.get('/api/settings', async () => {
    const row = db.select().from(settings).where(eq(settings.id, SETTINGS_ID)).get();
    return settingsSchema.parse(row ?? { ...DEFAULT_SETTINGS, updatedAt: 0 });
  });

  app.put('/api/settings', async (request) => {
    const values = {
      ...parseRequest(settingsInputSchema, request.body),
      updatedAt: Date.now(),
    };
    db.insert(settings)
      .values({ id: SETTINGS_ID, ...values })
      .onConflictDoUpdate({ target: settings.id, set: values })
      .run();
    return settingsSchema.parse(values);
  });
}
