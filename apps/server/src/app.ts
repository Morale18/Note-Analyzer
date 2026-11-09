import Fastify, { type FastifyError, type FastifyInstance } from 'fastify';
import type { Db } from './db/client';
import { attemptRoutes } from './routes/attempts';
import { sessionRoutes } from './routes/sessions';
import { settingsRoutes } from './routes/settings';
import { statsRoutes } from './routes/stats';
import { RequestValidationError } from './routes/validation';

export function buildApp(db: Db, options: { logger?: boolean } = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  app.setErrorHandler((error: FastifyError, _request, reply) => {
    if (error instanceof RequestValidationError) {
      return reply.status(400).send({ error: error.message, issues: error.issues });
    }
    const status = error.statusCode ?? 500;
    if (status >= 500) app.log.error(error);
    return reply
      .status(status)
      .send({ error: status >= 500 ? 'Internal Server Error' : error.message });
  });

  settingsRoutes(app, db);
  sessionRoutes(app, db);
  attemptRoutes(app, db);
  statsRoutes(app, db);
  return app;
}
