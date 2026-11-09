import { buildApp } from './app';
import { DEFAULT_DB_PATH, openDb } from './db/client';

const port = Number(process.env.PORT ?? 3001);
const { db, close } = openDb(process.env.DB_PATH ?? DEFAULT_DB_PATH);
const app = buildApp(db, { logger: true });

async function shutdown(): Promise<void> {
  await app.close();
  close();
  process.exit(0);
}
process.on('SIGINT', () => void shutdown());
process.on('SIGTERM', () => void shutdown());

// Loopback only: phones reach the API through the Vite HTTPS proxy.
await app.listen({ host: '127.0.0.1', port });
