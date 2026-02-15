import { sleepMs } from "@/lib/retry";

export class RateGate {
  private nextAllowedAt = 0;
  private chain: Promise<void> = Promise.resolve();
  private readonly minIntervalMs: number;

  constructor(minIntervalMs: number) {
    this.minIntervalMs = Math.max(0, Math.trunc(minIntervalMs));
  }

  async wait(): Promise<number> {
    if (this.minIntervalMs <= 0) return 0;

    let waited = 0;
    // Serialize waits to avoid races when concurrency > 1.
    this.chain = this.chain.then(async () => {
      const now = Date.now();
      const delay = Math.max(0, this.nextAllowedAt - now);
      if (delay > 0) {
        waited = delay;
        await sleepMs(delay);
      }
      this.nextAllowedAt = Date.now() + this.minIntervalMs;
    });
    await this.chain;
    return waited;
  }
}

