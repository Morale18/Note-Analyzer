import {
  TUNINGS,
  midiOctave,
  midiToFrequency,
  pitchClassName,
  sensitivityToGate,
  type Tuning,
} from '@fretboard/shared';
import { useSettings } from '../settings';
import { IN_TUNE_CENTS, type TunerState } from '../tuner/machine';
import { useTuner } from '../tuner/useTuner';

const GAUGE_CENTER_X = 171;
const GAUGE_CENTER_Y = 198;
const GAUGE_RADIUS = 152;
/** Needle angle at the ends of the scale, either side of straight up. */
const GAUGE_MAX_DEGREES = 70;
const GAUGE_MAX_CENTS = 50;
const GAUGE_TICKS = [-50, -40, -30, -20, -10, 10, 20, 30, 40, 50];

function centsToDegrees(cents: number): number {
  const clamped = Math.max(-GAUGE_MAX_CENTS, Math.min(GAUGE_MAX_CENTS, cents));
  return (clamped / GAUGE_MAX_CENTS) * GAUGE_MAX_DEGREES;
}

function polar(degrees: number, radius: number): { x: number; y: number } {
  const radians = (degrees * Math.PI) / 180;
  return {
    x: GAUGE_CENTER_X + radius * Math.sin(radians),
    y: GAUGE_CENTER_Y - radius * Math.cos(radians),
  };
}

function arcPath(fromDegrees: number, toDegrees: number): string {
  const from = polar(fromDegrees, GAUGE_RADIUS);
  const to = polar(toDegrees, GAUGE_RADIUS);
  return `M ${from.x} ${from.y} A ${GAUGE_RADIUS} ${GAUGE_RADIUS} 0 0 1 ${to.x} ${to.y}`;
}

function Gauge({ cents, inTune }: { cents: number | null; inTune: boolean }) {
  const zone = centsToDegrees(IN_TUNE_CENTS);
  return (
    <svg
      className="tuner-gauge"
      viewBox="0 0 342 215"
      role="img"
      aria-label={cents === null ? 'Tuning meter, no note heard' : `Tuning meter, ${Math.round(cents)} cents`}
    >
      <path className="gauge-arc" d={arcPath(-GAUGE_MAX_DEGREES, GAUGE_MAX_DEGREES)} />
      <path className="gauge-zone" d={arcPath(-zone, zone)} />
      {GAUGE_TICKS.map((tick) => {
        const degrees = centsToDegrees(tick);
        const outer = polar(degrees, GAUGE_RADIUS - 12);
        const inner = polar(degrees, GAUGE_RADIUS - 24);
        return <line key={tick} className="gauge-tick" x1={outer.x} y1={outer.y} x2={inner.x} y2={inner.y} />;
      })}
      <line className="gauge-center" x1={GAUGE_CENTER_X} y1={58} x2={GAUGE_CENTER_X} y2={72} />

      <text className="gauge-scale" x={24} y={180}>
        -50
      </text>
      <text className="gauge-scale" x={318} y={180} textAnchor="end">
        +50
      </text>
      <text className="gauge-word" x={72} y={200} textAnchor="middle">
        flat
      </text>
      <text className="gauge-word" x={270} y={200} textAnchor="middle">
        sharp
      </text>

      {/* With nothing heard the needle rests at the end of the scale, not on the in-tune mark. */}
      <g
        className="gauge-needle"
        data-idle={cents === null}
        data-in-tune={inTune}
        style={{
          transform: `rotate(${cents === null ? -GAUGE_MAX_DEGREES : centsToDegrees(cents)}deg)`,
          transformOrigin: `${GAUGE_CENTER_X}px ${GAUGE_CENTER_Y}px`,
        }}
      >
        <line x1={GAUGE_CENTER_X} y1={GAUGE_CENTER_Y} x2={GAUGE_CENTER_X} y2={GAUGE_CENTER_Y - 142} />
        <circle className="gauge-hub" cx={GAUGE_CENTER_X} cy={GAUGE_CENTER_Y} r={9} />
        <circle className="gauge-pin" cx={GAUGE_CENTER_X} cy={GAUGE_CENTER_Y} r={3} />
      </g>
    </svg>
  );
}

function TuningPicker({
  value,
  notes,
  onChange,
}: {
  value: Tuning;
  notes: string;
  onChange: (id: string) => void;
}) {
  return (
    <label className="tuner-picker">
      <span className="tuner-picker-name">{value.name}</span>
      <span className="tuner-picker-notes">{notes}</span>
      <svg className="tuner-chevron" viewBox="0 0 24 24" aria-hidden="true">
        <path d="m6 9 6 6 6-6" />
      </svg>
      {/* Invisible, but it's what gets tapped, so phones show their native picker. */}
      <select
        aria-label="Tuning"
        value={value.id}
        onChange={(event) => onChange(event.target.value)}
      >
        {TUNINGS.map((tuning) => (
          <option key={tuning.id} value={tuning.id}>
            {tuning.name}
          </option>
        ))}
      </select>
    </label>
  );
}

function guidance({ phase, cents, heldSinceMs }: TunerState): string {
  if (phase === 'idle') return 'Tap Start, then pluck the string';
  if (phase === 'complete') return 'All strings in tune';
  if (phase === 'passed') return 'In tune';
  if (cents === null) return 'Pluck the string';
  if (heldSinceMs !== null) return 'In tune — let it ring';
  const distance = Math.abs(cents);
  if (cents < 0) {
    if (distance < 15) return 'Slightly flat — tighten a touch';
    return distance < 50 ? 'Flat — tighten the peg' : 'Very flat — keep tightening';
  }
  if (distance < 15) return 'Slightly sharp — loosen a touch';
  return distance < 50 ? 'Sharp — loosen the peg' : 'Very sharp — keep loosening';
}

export function TunerPage() {
  const { settings } = useSettings();
  const { state, tuning, auto, starting, error, start, stop, restart, selectString, chooseTuning, toggleAuto } =
    useTuner(sensitivityToGate(settings.sensitivity));
  const style = settings.accidentalStyle;
  const name = (midi: number) => pitchClassName(midi, style);

  const idle = state.phase === 'idle';
  const complete = state.phase === 'complete';
  const target = tuning.strings[state.current];
  const targetHz = midiToFrequency(target);
  const cents = complete ? 0 : state.cents;
  const inTune = complete || state.phase === 'passed' || state.heldSinceMs !== null;

  return (
    <section className="tuner">
      <header className="tuner-header">
        <button className="tuner-icon-button" onClick={stop} aria-label="Stop tuning" hidden={idle}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="m15 18-6-6 6-6" />
          </svg>
        </button>
        <h1 className="tuner-title">Tuner</h1>
        <button className="tuner-auto" onClick={toggleAuto} aria-pressed={auto}>
          <span className="tuner-auto-dot" />
          Auto
        </button>
      </header>

      <TuningPicker
        value={tuning}
        notes={tuning.strings.map(name).join(' ')}
        onChange={chooseTuning}
      />

      <div className="tuner-gauge-card" data-in-tune={inTune}>
        <Gauge cents={cents} inTune={inTune} />
      </div>

      <div className="tuner-note" aria-hidden="true">
        {complete ? (
          <span className="tuner-note-done">✓</span>
        ) : (
          <>
            {name(target)}
            <sup>{midiOctave(target)}</sup>
          </>
        )}
      </div>

      <div className="tuner-status" aria-live="polite">
        {state.cents !== null && !complete && (
          <span className="tuner-pill" data-in-tune={inTune}>
            {Math.round(state.cents) > 0 ? '+' : ''}
            {Math.round(state.cents)}¢
          </span>
        )}
        {guidance(state)}
      </div>

      <p className="tuner-hz">
        {complete
          ? `${tuning.name} · ${tuning.strings.length} of ${tuning.strings.length} strings`
          : state.cents === null
            ? `target ${targetHz.toFixed(2)} Hz`
            : `${(targetHz * 2 ** (state.cents / 1200)).toFixed(2)} Hz · target ${targetHz.toFixed(2)} Hz`}
      </p>

      <div className="tuner-strings">
        {tuning.strings.map((midi, index) => (
          <button
            key={index}
            className="tuner-string"
            aria-label={`String ${tuning.strings.length - index}, ${name(midi)}${midiOctave(midi)}${state.tuned[index] ? ', in tune' : ''}`}
            aria-current={!idle && !complete && index === state.current ? 'step' : undefined}
            data-tuned={state.tuned[index] === true}
            disabled={idle}
            onClick={() => selectString(index)}
          >
            {name(midi)}
            {state.tuned[index] && (
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m5 13 4 4L19 7" />
              </svg>
            )}
          </button>
        ))}
      </div>

      {idle && (
        <button
          className="button button-primary tuner-action"
          onClick={() => void start()}
          disabled={starting}
        >
          {starting ? 'Starting…' : 'Start'}
        </button>
      )}
      {complete && (
        <button className="button button-primary tuner-action" onClick={restart}>
          Tune again
        </button>
      )}
      {error && (
        <p className="error-message" role="alert">
          {error}
        </p>
      )}

      <p className="tuner-footnote">
        A4 = 440 Hz · low {name(tuning.strings[0])} on the left
      </p>
    </section>
  );
}
