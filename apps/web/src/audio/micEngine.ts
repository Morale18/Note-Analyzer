import type { AudioFrame, PitchProcessorOptions } from './frame';
import processorUrl from './pitchProcessor.ts?worker&url';

export class MicError extends Error {}

function describeMicFailure(error: unknown): string {
  const name = error instanceof DOMException ? error.name : '';
  if (name === 'NotAllowedError') {
    return 'Microphone access was blocked. Allow it for this site in your browser settings, then try again.';
  }
  if (name === 'NotFoundError') return 'No microphone was found on this device.';
  return 'Couldn’t start the microphone. Close other apps using it and try again.';
}

export class MicEngine {
  private context: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private node: AudioWorkletNode | null = null;

  /**
   * Must be called synchronously from a tap: iOS only lets an AudioContext run if
   * it's created and resumed inside the gesture, so that happens before any await.
   * Resolves false if `stop` was called while starting.
   */
  async start(
    onFrame: (frame: AudioFrame) => void,
    detectorOptions?: PitchProcessorOptions,
  ): Promise<boolean> {
    this.stop();
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicError(
        'The microphone needs a secure connection. Open the https:// address printed by npm run dev.',
      );
    }

    const context = new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    void context.resume();

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      if (this.context !== context) {
        stream.getTracks().forEach((track) => track.stop());
        return false;
      }
      this.stream = stream;

      await context.audioWorklet.addModule(processorUrl);
      if (this.context !== context) return false;

      const node = new AudioWorkletNode(context, 'pitch-processor', {
        numberOfInputs: 1,
        numberOfOutputs: 1,
        outputChannelCount: [1],
        processorOptions: detectorOptions,
      });
      node.port.onmessage = (event: MessageEvent<AudioFrame>) => onFrame(event.data);
      this.node = node;

      // The worklet writes no output; the connection is only so the graph gets pulled.
      context.createMediaStreamSource(stream).connect(node).connect(context.destination);
      void context.resume();
      return true;
    } catch (error) {
      this.stop();
      throw new MicError(describeMicFailure(error));
    }
  }

  /** Recovers from iOS interruptions such as locking the screen. */
  resume(): void {
    void this.context?.resume();
  }

  stop(): void {
    if (this.node) this.node.port.onmessage = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.context?.close();
    this.node = null;
    this.stream = null;
    this.context = null;
  }
}
