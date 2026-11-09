import { midiToFrequency } from '@fretboard/shared';

const ATTACK_S = 0.005;
const RING_S = 2;
const RELEASE_S = 0.05;
const PEAK_GAIN = 0.7;
/** Harmonic strengths for a plucked sound. The upper ones keep low notes audible on phone speakers. */
const HARMONICS = [0, 1, 0.7, 0.45, 0.3, 0.2, 0.12, 0.08];

interface Voice {
  oscillator: OscillatorNode;
  /** Separate from the envelope, so cutting a note off fades from its current level. */
  fader: GainNode;
}

export class NotePlayer {
  private context: AudioContext | null = null;
  private wave: PeriodicWave | null = null;
  private voice: Voice | null = null;

  /** Must be called synchronously from a tap: phones only start audio inside a gesture. */
  start(): void {
    this.stop();
    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    this.wave = context.createPeriodicWave(
      new Float32Array(HARMONICS.length),
      Float32Array.from(HARMONICS),
    );
    void context.resume();
  }

  /** Recovers from iOS interruptions such as locking the screen. */
  resume(): void {
    void this.context?.resume();
  }

  /** Plays one note, cutting off whichever note is still ringing. */
  play(midi: number): void {
    const { context, wave } = this;
    if (!context || !wave) return;
    void context.resume();
    this.silenceVoice(context.currentTime);

    const now = context.currentTime;
    const oscillator = context.createOscillator();
    oscillator.setPeriodicWave(wave);
    oscillator.frequency.value = midiToFrequency(midi);

    const envelope = context.createGain();
    envelope.gain.setValueAtTime(0.0001, now);
    envelope.gain.linearRampToValueAtTime(PEAK_GAIN, now + ATTACK_S);
    envelope.gain.exponentialRampToValueAtTime(0.0001, now + RING_S);

    const fader = context.createGain();
    oscillator.connect(envelope).connect(fader).connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + RING_S);
    this.voice = { oscillator, fader };
  }

  stop(): void {
    void this.context?.close();
    this.context = null;
    this.wave = null;
    this.voice = null;
  }

  private silenceVoice(now: number): void {
    if (!this.voice) return;
    const { oscillator, fader } = this.voice;
    // Fading rather than cutting avoids an audible click.
    fader.gain.setTargetAtTime(0, now, RELEASE_S / 4);
    oscillator.stop(now + RELEASE_S);
    this.voice = null;
  }
}
