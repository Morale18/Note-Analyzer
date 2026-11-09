import { NoteStabilizer } from '@fretboard/dsp';
import { findTuning, stringOffsetCents, type Tuning } from '@fretboard/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { safeStorage } from '../api/instance';
import type { AudioFrame } from '../audio/frame';
import { MicEngine, MicError } from '../audio/micEngine';
import { ScreenWakeLock } from '../audio/wakeLock';
import { initialTunerState, median, tunerReducer, type TunerEvent, type TunerState } from './machine';

const TUNING_KEY = 'fretboard.tuning.v1';
const AUTO_KEY = 'fretboard.tuner-auto.v1';
const MIN_CLARITY = 0.9;
const PASS_DISPLAY_MS = 700;
/** About 100 ms of frames. */
const SMOOTHING_FRAMES = 5;
/** Under Drop C's 65 Hz low string, with room for one that starts out flat. */
const DETECTOR_OPTIONS = { minFrequency: 50 };

export function useTuner(gateRms: number) {
  const [state, setState] = useState<TunerState>(initialTunerState);
  const [tuning, setTuning] = useState<Tuning>(() => findTuning(safeStorage.getItem(TUNING_KEY)));
  const [auto, setAuto] = useState(() => safeStorage.getItem(AUTO_KEY) !== 'off');
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Audio callbacks and timers outlive renders, so the live values sit in refs.
  const stateRef = useRef(state);
  const tuningRef = useRef(tuning);
  const autoRef = useRef(auto);
  const gateRef = useRef(gateRms);
  gateRef.current = gateRms;
  const engineRef = useRef(new MicEngine());
  const wakeLockRef = useRef(new ScreenWakeLock());
  const ringGuardRef = useRef<NoteStabilizer | null>(null);
  const recentCentsRef = useRef<number[]>([]);
  const nextTimerRef = useRef<number | undefined>(undefined);

  const send = useCallback((event: TunerEvent): TunerState => {
    const next = tunerReducer(stateRef.current, event);
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  /** The string that was just played may still be ringing; it shouldn't read as the new one. */
  const changeTarget = useCallback(
    (event: TunerEvent) => {
      window.clearTimeout(nextTimerRef.current);
      recentCentsRef.current = [];
      ringGuardRef.current?.lock();
      send(event);
    },
    [send],
  );

  const handleFrame = useCallback(
    (frame: AudioFrame) => {
      const guard = ringGuardRef.current;
      const current = stateRef.current;
      if (!guard || current.phase !== 'listening') return;

      guard.push({ timeMs: frame.timeMs, rms: frame.rms, midi: null, clarity: 0 });
      const usable =
        guard.state === 'listening' && frame.rms >= gateRef.current && frame.clarity >= MIN_CLARITY;
      const offset =
        usable && frame.frequency !== null
          ? stringOffsetCents(frame.frequency, tuningRef.current.strings[current.current])
          : null;

      if (offset === null) recentCentsRef.current = [];
      else recentCentsRef.current = [...recentCentsRef.current, offset].slice(-SMOOTHING_FRAMES);
      const cents = recentCentsRef.current.length > 0 ? median(recentCentsRef.current) : null;

      const next = send({ type: 'reading', cents, nowMs: frame.timeMs });
      if (next.phase === 'passed') {
        nextTimerRef.current = window.setTimeout(
          () => changeTarget({ type: 'next', auto: autoRef.current }),
          PASS_DISPLAY_MS,
        );
      }
    },
    [changeTarget, send],
  );

  const stop = useCallback(() => {
    window.clearTimeout(nextTimerRef.current);
    engineRef.current.stop();
    wakeLockRef.current.release();
    ringGuardRef.current = null;
    recentCentsRef.current = [];
    send({ type: 'stop' });
  }, [send]);

  const restart = useCallback(() => {
    changeTarget({ type: 'begin', stringCount: tuningRef.current.strings.length });
  }, [changeTarget]);

  /** Call directly from the Start button's tap handler. */
  const start = useCallback(async () => {
    setError(null);
    setStarting(true);
    // Its hold time is never reached: it's only here for its ring-out detection.
    ringGuardRef.current = new NoteStabilizer({ gateRms: gateRef.current, holdMs: Infinity });
    try {
      if (!(await engineRef.current.start(handleFrame, DETECTOR_OPTIONS))) return;
    } catch (cause) {
      ringGuardRef.current = null;
      setError(cause instanceof MicError ? cause.message : 'Couldn’t start the microphone.');
      return;
    } finally {
      setStarting(false);
    }
    void wakeLockRef.current.acquire();
    restart();
  }, [handleFrame, restart]);

  const chooseTuning = useCallback(
    (id: string) => {
      const next = findTuning(id);
      tuningRef.current = next;
      setTuning(next);
      safeStorage.setItem(TUNING_KEY, next.id);
      if (stateRef.current.phase !== 'idle') restart();
    },
    [restart],
  );

  const toggleAuto = useCallback(() => {
    autoRef.current = !autoRef.current;
    setAuto(autoRef.current);
    safeStorage.setItem(AUTO_KEY, autoRef.current ? 'on' : 'off');
  }, []);

  const selectString = useCallback(
    (stringIndex: number) => changeTarget({ type: 'select', stringIndex }),
    [changeTarget],
  );

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && stateRef.current.phase !== 'idle') {
        engineRef.current.resume();
        void wakeLockRef.current.acquire();
      }
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [stop]);

  return { state, tuning, auto, starting, error, start, stop, restart, selectString, chooseTuning, toggleAuto };
}
