import {
  STRING_LABELS,
  midiToNoteName,
  pitchClassName,
  sensitivityToGate,
} from '@fretboard/shared';
import { LiveReadout } from '../components/LiveReadout';
import { SyncNotice } from '../components/SyncNotice';
import type { Score } from '../quiz/machine';
import { useQuiz } from '../quiz/useQuiz';
import { useSettings } from '../settings';

function accuracyText(score: Score): string {
  return score.total === 0 ? '—' : `${Math.round((score.correct / score.total) * 100)}%`;
}

export function PracticePage() {
  const { settings } = useSettings();
  const { state, starting, error, liveFrame, start, stop, skip } = useQuiz(settings);
  const style = settings.accidentalStyle;

  if (state.phase === 'idle') {
    return (
      <section className="practice-idle">
        <h1 className="brand">Fretboard Trainer</h1>
        {state.score.total > 0 && (
          <p className="last-session">
            Last run: {state.score.correct}/{state.score.total} ({accuracyText(state.score)}), best
            streak {state.score.bestStreak}
          </p>
        )}
        <button className="start-button" onClick={() => void start()} disabled={starting}>
          {starting ? 'Starting…' : 'Start'}
        </button>
        {error && (
          <p className="error-message" role="alert">
            {error}
          </p>
        )}
        <SyncNotice />
      </section>
    );
  }

  const flash =
    state.phase === 'result' ? (state.grade.correct ? 'correct' : 'wrong') : undefined;

  return (
    <section className="practice" data-flash={flash}>
      <header className="scoreboard">
        <div className="score-item">
          <span className="score-value">{state.score.streak}</span>
          <span className="score-label">Streak</span>
        </div>
        <div className="score-item">
          <span className="score-value">{accuracyText(state.score)}</span>
          <span className="score-label">
            Accuracy ({state.score.correct}/{state.score.total})
          </span>
        </div>
      </header>

      <div className="prompt" aria-live="polite">
        <div className="prompt-note">{pitchClassName(state.prompt.note, style)}</div>
        <div className="prompt-string">on the {STRING_LABELS[state.prompt.stringIndex]} string</div>
      </div>

      {state.phase === 'result' ? (
        <div className="result" role="status">
          <div className="result-title">{state.grade.correct ? '✓ Correct' : '✗ Try again'}</div>
          <div className="result-detail">
            You played {midiToNoteName(state.grade.playedMidi, style)}
            {!state.grade.correct && ` · wanted ${midiToNoteName(state.grade.targetMidi, style)}`}
          </div>
        </div>
      ) : (
        <LiveReadout
          frame={liveFrame}
          gateRms={sensitivityToGate(settings.sensitivity)}
          accidentalStyle={style}
        />
      )}

      <div className="practice-actions">
        <button className="button" onClick={stop}>
          Stop
        </button>
        <button className="button button-primary" onClick={skip} disabled={state.phase !== 'listening'}>
          Skip
        </button>
      </div>
      <SyncNotice />
    </section>
  );
}
