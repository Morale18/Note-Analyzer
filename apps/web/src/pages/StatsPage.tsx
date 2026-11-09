import { STRING_LABELS, pitchClassName, type Stats } from '@fretboard/shared';
import { useCallback, useEffect, useState } from 'react';
import { api } from '../api/client';
import { outbox } from '../api/instance';
import { SyncNotice } from '../components/SyncNotice';
import { useSettings } from '../settings';

function percent(accuracy: number): string {
  return `${Math.round(accuracy * 100)}%`;
}

function AccuracyRow(props: { label: string; correct: number; total: number; accuracy: number }) {
  const { label, correct, total, accuracy } = props;
  return (
    <li className="accuracy-row">
      <span className="accuracy-label">{label}</span>
      <span className="accuracy-track">
        <span className="accuracy-fill" style={{ width: percent(accuracy) }} />
      </span>
      <span className="accuracy-value">{percent(accuracy)}</span>
      <span className="accuracy-count">
        {correct}/{total}
      </span>
    </li>
  );
}

const dateFormat = new Intl.DateTimeFormat(undefined, {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

export function StatsPage() {
  const { settings } = useSettings();
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);
  const [confirmingReset, setConfirmingReset] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      await outbox.flush();
      setStats(await api.getStats());
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function reset() {
    setConfirmingReset(false);
    try {
      setStats(await api.resetStats());
      outbox.clearPractice();
    } catch {
      setFailed(true);
    }
  }

  return (
    <div className="stats">
      <h1>Stats</h1>
      <SyncNotice />

      {failed && (
        <div className="error-message" role="alert">
          <p>Can’t reach the server.</p>
          <button className="button" onClick={() => void load()}>
            Try again
          </button>
        </div>
      )}

      {!stats && !failed && <p className="hint">Loading…</p>}

      {stats && stats.overall.total === 0 && (
        <p className="hint">No attempts yet. Play a few notes on the Practice page.</p>
      )}

      {stats && stats.overall.total > 0 && (
        <>
          <div className="stats-hero">
            <span className="stats-hero-value">{percent(stats.overall.accuracy)}</span>
            <span className="stats-hero-label">
              overall · {stats.overall.correct} of {stats.overall.total} correct
            </span>
          </div>

          <section className="settings-section">
            <h2>By note</h2>
            <ul className="accuracy-list">
              {stats.perNote.map((row) => (
                <AccuracyRow
                  key={row.note}
                  {...row}
                  label={pitchClassName(row.note, settings.accidentalStyle)}
                />
              ))}
            </ul>
          </section>

          <section className="settings-section">
            <h2>By string</h2>
            <ul className="accuracy-list">
              {stats.perString.map((row) => (
                <AccuracyRow
                  key={row.stringIndex}
                  {...row}
                  label={STRING_LABELS[row.stringIndex]!}
                />
              ))}
            </ul>
          </section>

          <section className="settings-section">
            <h2>Recent sessions</h2>
            <ul className="session-list">
              {stats.recentSessions.map((session) => (
                <li key={session.id} className="session-row">
                  <span>{dateFormat.format(session.startedAt)}</span>
                  <span className="session-score">
                    <strong>{percent(session.accuracy)}</strong>
                    <span className="accuracy-count">
                      {session.correct}/{session.total}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="settings-section">
            {confirmingReset ? (
              <div className="button-row">
                <button className="button button-danger" onClick={() => void reset()}>
                  Delete all stats
                </button>
                <button className="button" onClick={() => setConfirmingReset(false)}>
                  Cancel
                </button>
              </div>
            ) : (
              <button className="button" onClick={() => setConfirmingReset(true)}>
                Reset stats
              </button>
            )}
          </section>
        </>
      )}
    </div>
  );
}
