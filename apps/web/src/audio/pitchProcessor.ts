import { createMpmDetector, rms, type PitchDetector } from '@fretboard/dsp';
import type { AudioFrame, PitchProcessorOptions } from './frame';

// Globals of AudioWorkletGlobalScope, which TypeScript's DOM lib doesn't describe.
declare const sampleRate: number;
declare const currentTime: number;
declare function registerProcessor(name: string, processor: unknown): void;
declare class AudioWorkletProcessor {
  readonly port: MessagePort;
}

const HOP_SIZE = 1024;

class PitchProcessor extends AudioWorkletProcessor {
  private readonly detector: PitchDetector;
  private readonly ring: Float32Array;
  private readonly window: Float32Array;
  private writeIndex = 0;
  private filled = 0;
  private samplesSinceAnalysis = 0;

  constructor(options: { processorOptions?: PitchProcessorOptions }) {
    super();
    this.detector = createMpmDetector({ sampleRate, ...options.processorOptions });
    this.ring = new Float32Array(this.detector.windowSize);
    this.window = new Float32Array(this.detector.windowSize);
  }

  process(inputs: Float32Array[][]): boolean {
    const channel = inputs[0]?.[0];
    if (!channel) return true;

    const size = this.ring.length;
    for (let i = 0; i < channel.length; i++) {
      this.ring[this.writeIndex] = channel[i];
      this.writeIndex = (this.writeIndex + 1) % size;
    }
    this.filled = Math.min(size, this.filled + channel.length);
    this.samplesSinceAnalysis += channel.length;

    if (this.filled === size && this.samplesSinceAnalysis >= HOP_SIZE) {
      this.samplesSinceAnalysis -= HOP_SIZE;
      this.analyze();
    }
    return true;
  }

  private analyze(): void {
    const size = this.ring.length;
    this.window.set(this.ring.subarray(this.writeIndex));
    this.window.set(this.ring.subarray(0, this.writeIndex), size - this.writeIndex);

    const pitch = this.detector.detect(this.window);
    const frame: AudioFrame = {
      timeMs: currentTime * 1000,
      // Measured over the newest hop only, so attacks show up quickly.
      rms: rms(this.window.subarray(size - HOP_SIZE)),
      frequency: pitch?.frequency ?? null,
      clarity: pitch?.clarity ?? 0,
    };
    this.port.postMessage(frame);
  }
}

registerProcessor('pitch-processor', PitchProcessor);
