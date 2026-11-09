import { api } from './client';
import { Outbox, type OutboxStorage } from './outbox';

const RETRY_INTERVAL_MS = 10_000;

export const safeStorage: OutboxStorage = {
  getItem(key) {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setItem(key, value) {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Unavailable (e.g. private browsing): nothing persists, but the app still works.
    }
  },
};

export const outbox = new Outbox(safeStorage, api);

/** Keeps retrying queued writes for as long as the app is open. */
export function startOutboxSync(): () => void {
  const flush = () => void outbox.flush();
  const timer = setInterval(flush, RETRY_INTERVAL_MS);
  window.addEventListener('online', flush);
  document.addEventListener('visibilitychange', flush);
  flush();
  return () => {
    clearInterval(timer);
    window.removeEventListener('online', flush);
    document.removeEventListener('visibilitychange', flush);
  };
}
