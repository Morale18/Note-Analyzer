/** Keeps the screen on while held. Failure is harmless, so it's ignored. */
export class ScreenWakeLock {
  private sentinel: WakeLockSentinel | null = null;

  async acquire(): Promise<void> {
    try {
      this.sentinel = (await navigator.wakeLock?.request('screen')) ?? null;
    } catch {
      this.sentinel = null;
    }
  }

  release(): void {
    void this.sentinel?.release().catch(() => undefined);
    this.sentinel = null;
  }
}
