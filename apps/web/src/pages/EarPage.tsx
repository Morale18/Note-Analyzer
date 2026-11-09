import { listEarNotes, pitchClassName } from '@fretboard/shared';
import { useEarQuiz } from '../ear/useEarQuiz';
import { accuracyText } from '../quiz/machine';
import { useSettings } from '../settings';

export function EarPage() {
  const { settings } = useSettings();
  const { state, start, stop, answer, replay } = useEarQuiz(settings.ear);
  const name = (note: number) => pitchClassName(note, settings.accidentalStyle);

  if (state.phase === 'idle') {
    return (
      <section className="practice-idle">
        <h1 className="brand">Ear Training</h1>
        {state.score.total > 0 && (
          <p className="last-session">
            Last run: {state.score.correct}/{state.score.total} ({accuracyText(state.score)}), best
            streak {state.score.bestStreak}
          </p>
        )}
        <button className="start-button" onClick={start}>
          Start
        </button>
        <p className="hint">
          Notes: {listEarNotes(settings.ear).map(name).join(' ')}.{' '}
          <a href="#/settings/ear">Change</a>
        </p>
        <p className="hint">On iPhone, turn off silent mode to hear the notes.</p>
      </section>
    );
  }

  const flash = state.phase === 'result' ? (state.correct ? 'correct' : 'wrong') : undefined;

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
        {state.phase === 'result' ? (
          <>
            <div className="prompt-note">{name(state.question.note)}</div>
            <div className="prompt-string">
              {state.correct ? '✓ Correct' : `✗ You picked ${name(state.picked)}`}
            </div>
          </>
        ) : (
          <>
            <div className="prompt-note">?</div>
            <div className="prompt-string">Which note is this?</div>
          </>
        )}
      </div>

      <div className="ear-options">
        {state.question.options.map((note) => (
          <button
            key={note}
            className="button ear-option"
            onClick={() => answer(note)}
            disabled={state.phase !== 'asking'}
          >
            {name(note)}
          </button>
        ))}
      </div>

      <div className="practice-actions">
        <button className="button" onClick={stop}>
          Stop
        </button>
        <button
          className="button button-primary"
          onClick={replay}
          disabled={state.phase !== 'asking'}
        >
          Play again
        </button>
      </div>
    </section>
  );
}
