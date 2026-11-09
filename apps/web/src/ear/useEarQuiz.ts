import { generateEarQuestion, type EarSetup } from '@fretboard/shared';
import { useCallback, useEffect, useRef, useState } from 'react';
import { NotePlayer } from '../audio/notePlayer';
import { earReducer, initialEarState, type EarEvent, type EarState } from './machine';

const CORRECT_DISPLAY_MS = 1000;
// A miss stays up longer so there's time to read the right answer.
const WRONG_DISPLAY_MS = 2000;

export function useEarQuiz(setup: EarSetup) {
  const [state, setState] = useState<EarState>(initialEarState);

  // Timers outlive renders, so the live values sit in refs.
  const stateRef = useRef(state);
  const setupRef = useRef(setup);
  setupRef.current = setup;
  const playerRef = useRef(new NotePlayer());
  const advanceTimerRef = useRef<number | undefined>(undefined);

  const send = useCallback((event: EarEvent): EarState => {
    const next = earReducer(stateRef.current, event);
    stateRef.current = next;
    setState(next);
    return next;
  }, []);

  const ask = useCallback(
    (type: 'begin' | 'next', previousNote: number | null) => {
      const question = generateEarQuestion(setupRef.current, { previousNote });
      if (!question) return;
      send({ type, question });
      playerRef.current.play(question.midi);
    },
    [send],
  );

  /** Call directly from the Start button's tap handler. */
  const start = useCallback(() => {
    playerRef.current.start();
    ask('begin', null);
  }, [ask]);

  const answer = useCallback(
    (note: number) => {
      if (stateRef.current.phase !== 'asking') return;
      const result = send({ type: 'answer', note });
      if (result.phase !== 'result') return;
      advanceTimerRef.current = window.setTimeout(
        () => ask('next', result.question.note),
        result.correct ? CORRECT_DISPLAY_MS : WRONG_DISPLAY_MS,
      );
    },
    [ask, send],
  );

  const replay = useCallback(() => {
    const current = stateRef.current;
    if (current.phase === 'asking') playerRef.current.play(current.question.midi);
  }, []);

  const stop = useCallback(() => {
    window.clearTimeout(advanceTimerRef.current);
    playerRef.current.stop();
    send({ type: 'stop' });
  }, [send]);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') playerRef.current.resume();
    };
    document.addEventListener('visibilitychange', onVisibilityChange);
    window.addEventListener('pagehide', stop);
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange);
      window.removeEventListener('pagehide', stop);
      stop();
    };
  }, [stop]);

  return { state, start, stop, answer, replay };
}
