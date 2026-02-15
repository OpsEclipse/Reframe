export class Semaphore {
  private available: number;
  private readonly queue: Array<(release: () => void) => void> = [];

  constructor(permits: number) {
    const p = Math.max(1, Math.trunc(permits));
    this.available = p;
  }

  async acquire(): Promise<() => void> {
    if (this.available > 0) {
      this.available -= 1;
      return () => this.release();
    }
    return await new Promise<() => void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  private release() {
    const next = this.queue.shift();
    if (next) {
      next(() => this.release());
      return;
    }
    this.available += 1;
  }
}

