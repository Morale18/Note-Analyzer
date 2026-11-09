/** Sent to the worklet when it's created. */
export interface PitchProcessorOptions {
  minFrequency?: number;
}

/** One analysis result, posted from the worklet to the main thread. */
export interface AudioFrame {
  /** Audio-clock time of the frame. */
  timeMs: number;
  rms: number;
  frequency: number | null;
  clarity: number;
}
