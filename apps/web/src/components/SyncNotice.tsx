import { useSyncExternalStore } from 'react';
import { outbox } from '../api/instance';

/** Tells the user when attempts are being held locally. */
export function SyncNotice() {
  const { pendingAttempts, unreachable } = useSyncExternalStore(outbox.subscribe, outbox.getStatus);
  if (!unreachable) return null;
  return (
    <p className="sync-notice" role="status">
      Server unreachable.{' '}
      {pendingAttempts > 0
        ? `${pendingAttempts} ${pendingAttempts === 1 ? 'attempt' : 'attempts'} saved here, will sync when it’s back.`
        : 'Practice still works and will sync when it’s back.'}
    </p>
  );
}
