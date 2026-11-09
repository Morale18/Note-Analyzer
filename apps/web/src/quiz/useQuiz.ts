import { NoteStabilizer } from '@fretboard/dsp';
import {
  frequencyToMidi,
  generatePrompt,
  sensitivityToGate,
  type NoteTally,
  type Prompt,
  type SettingsInput,
} from '@fretboard/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api/client';
import { outbox } from '../api/instance';
import type { AudioFrame } from '../audio/frame';
import { MicEngine, MicError } from '../audio/micEngine';
import { ScreenWakeLock } from '../audio/wakeLock';
import { initialQuizState, quizReducer, type QuizEvent, type QuizState } from './machine';

const RESULT_DISPLAY_MS = 1000;

function addTally(tallies: Map<number, NoteTally>, note: number, tally: NoteTally): void {
  const existing = tallies.get(note) ?? { correct: 0, total: 0 };
  tallies.set(note, {
    correct: existing.correct + tally.correct,
    total: existing.total + tally.total,
  });
}

export function useQuiz(settings: SettingsInput) {
  const [state, setState] = useState<QuizState>(initialQuizState);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [liveFrame, setLiveFrame] = useState<AudioFrame | null>(null);

  // Audio callbacks and timers outlive renders, so the live values sit in refs.
  const stateRef = useRef(state);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  const engineRef = useRef(new MicEngine());
  const wakeLockRef = useRef(new ScreenWakeLock());
  const stabilizerRef = useRef<NoteStabilizer | null>(null);
  const sessionIdRef = useRef<string | null>(null);
  const advanceTimerRef = useRef<number | undefined>(undefined);
  const animationRef = useRef<number | undefined>(undefined);
  const latestFrameRef = useRef<AudioFrame | null>(null);
  const historicalTalliesRef = useRef(new Map<number, NoteTally>());
  const sessionTalliesRef = useRef(new Map<number, NoteTally>());

  const send = useCallback((event: QuizEvent): QuizState => {
    const next = quizReducer(stateRef.current, event);
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  const pickPrompt = useCallback((previous: Prompt | null): Prompt | null => {
    const current = settingsRef.current;
    let weakNoteTallies: Map<number, NoteTally> | null = null;
    if (current.weightWeakNotes) {
      weakNoteTallies = new Map(historicalTalliesRef.current);
      for (const [note, tally] of sessionTalliesRef.current) {
        addTally(weakNoteTallies, note, tally);
      }
    }
    return generatePrompt(current, { previous, weakNoteTallies });
  }, []);

  const advance = useCallback(
    (type: 'next' | 'skip') => {
      const current = stateRef.current;
      if (current.phase === 'idle') return;
      const prompt = pickPrompt(current.prompt);
      if (!prompt) return;
      window.clearTimeout(advanceTimerRef.current);
      // Whatever is still ringing belongs to the previous prompt.
      stabilizerRef.current?.lock();
      send({ type, prompt, now: Date.now() });
    },
    [pickPrompt, send],
  );

  const retry = useCallback(() => {
    // The wrong note may still be ringing; it shouldn't be graded again.
    stabilizerRef.current?.lock();
    send({ type: 'retry', now: Date.now() });
  }, [send]);

  const recordResult = useCallback(() => {
    const current = stateRef.current;
    const sessionId = sessionIdRef.current;
    if (current.phase !== 'result' || !sessionId) return;
    const { prompt, grade, responseTimeMs } = current;
    addTally(sessionTalliesRef.current, prompt.note, {
      correct: grade.correct ? 1 : 0,
      total: 1,
    });
    outbox.enqueue({
      kind: 'attempt',
      attempt: {
        id: crypto.randomUUID(),
        sessionId,
        stringIndex: prompt.stringIndex,
        targetNote: prompt.note,
        targetMidi: grade.targetMidi,
        playedMidi: grade.playedMidi,
        correct: grade.correct,
        responseTimeMs,
        createdAt: Date.now(),
      },
    });
  }, []);

  const handleFrame = useCallback(
    (frame: AudioFrame) => {
      latestFrameRef.current = frame;
      const played = stabilizerRef.current?.push({
        timeMs: frame.timeMs,
        rms: frame.rms,
        midi: frame.frequency === null ? null : frequencyToMidi(frame.frequency),
        clarity: frame.clarity,
      });
      if (played == null || stateRef.current.phase !== 'listening') return;

      const result = send({ type: 'note', midi: played, now: Date.now() });
      recordResult();
      const correct = result.phase === 'result' && result.grade.correct;
      advanceTimerRef.current = window.setTimeout(
        () => (correct ? advance('next') : retry()),
        RESULT_DISPLAY_MS,
      );
    },
    [advance, recordResult, retry, send],
  );

  const stop = useCallback(() => {
    const sessionId = sessionIdRef.current;
    sessionIdRef.current = null;
    window.clearTimeout(advanceTimerRef.current);
    if (animationRef.current !== undefined) cancelAnimationFrame(animationRef.current);
    animationRef.current = undefined;
    engineRef.current.stop();
    wakeLockRef.current.release();
    stabilizerRef.current = null;
    latestFrameRef.current = null;
    setLiveFrame(null);
    if (sessionId) {
      outbox.enqueue({ kind: 'session-end', id: sessionId, endedAt: Date.now() });
      send({ type: 'stop' });
    }
  }, [send]);

  /** Call directly from the Start button's tap handler. */
  const start = useCallback(async () => {
    if (sessionIdRef.current) return;
    const prompt = pickPrompt(null);
    if (!prompt) return;
    setError(null);
    setStarting(true);
    stabilizerRef.current = new NoteStabilizer({
      gateRms: sensitivityToGate(settingsRef.current.sensitivity),
    });
    try {
      if (!(await engineRef.current.start(handleFrame))) return;
    } catch (cause) {
      stabilizerRef.current = null;
      setError(cause instanceof MicError ? cause.message : 'Couldn’t start the microphone.');
      return;
    } finally {
      setStarting(false);
    }

    const sessionId = crypto.randomUUID();
    sessionIdRef.current = sessionId;
    sessionTalliesRef.current = new Map();
    outbox.enqueue({ kind: 'session-start', session: { id: sessionId, startedAt: Date.now() } });
    if (settingsRef.current.weightWeakNotes) {
      void api
        .getStats()
        .then((stats) => {
          historicalTalliesRef.current = new Map(stats.perNote.map((s) => [s.note, s]));
        })
        .catch(() => undefined);
    }

    void wakeLockRef.current.acquire();
    stabilizerRef.current.lock();
    send({ type: 'begin', prompt, now: Date.now() });

    const publishLiveFrame = () => {
      setLiveFrame(latestFrameRef.current);
      animationRef.current = requestAnimationFrame(publishLiveFrame);
    };
    animationRef.current = requestAnimationFrame(publishLiveFrame);
  }, [handleFrame, pickPrompt, send]);

  const skip = useCallback(() => {
    if (stateRef.current.phase === 'listening') advance('skip');
  }, [advance]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible' && sessionIdRef.current) {
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

  return { state, starting, error, liveFrame, start, stop, skip };
}
