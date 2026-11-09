import { centsOffset, midiToNoteName, frequencyToMidi, type AccidentalStyle } from '@fretboard/shared';
import type { AudioFrame } from '../audio/frame';

const MIN_DISPLAY_CLARITY = 0.85;
const IN_TUNE_CENTS = 10;
const METER_FLOOR_LOG = -3.5;

function levelPercent(rms: number): number {
  if (rms <= 0) return 0;
  return Math.min(100, Math.max(0, ((Math.log10(rms) - METER_FLOOR_LOG) / -METER_FLOOR_LOG) * 100));
}

interface LiveReadoutProps {
  frame: AudioFrame | null;
  gateRms: number;
  accidentalStyle: AccidentalStyle;
}

export function LiveReadout({ frame, gateRms, accidentalStyle }: LiveReadoutProps) {
  const heard =
    frame && frame.frequency !== null && frame.rms >= gateRms && frame.clarity >= MIN_DISPLAY_CLARITY
      ? frame.frequency
      : null;
  const midi = heard === null ? null : frequencyToMidi(heard);
  const cents = heard === null ? null : centsOffset(heard);
  const inTune = cents !== null && Math.abs(cents) <= IN_TUNE_CENTS;

  return (
    <div className="live">
      <div className="live-note" aria-hidden={midi === null}>
        {midi === null ? '—' : midiToNoteName(midi, accidentalStyle)}
      </div>

      <div className="cents" aria-label="Tuning offset">
        <div className="cents-center" />
        {cents !== null && (
          <div
            className="cents-needle"
            data-in-tune={inTune}
            style={{ left: `${50 + Math.max(-50, Math.min(50, cents))}%` }}
          />
        )}
      </div>
      <div className="cents-scale">
        <span>♭</span>
        <span className="cents-value">
          {cents === null ? 'listening…' : `${cents > 0 ? '+' : ''}${Math.round(cents)}¢`}
        </span>
        <span>♯</span>
      </div>

      <div className="level" aria-label="Input level">
        <div className="level-fill" style={{ width: `${levelPercent(frame?.rms ?? 0)}%` }} />
        <div className="level-gate" style={{ left: `${levelPercent(gateRms)}%` }} />
      </div>
    </div>
  );
}
