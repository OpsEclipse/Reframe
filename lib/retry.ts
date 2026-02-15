export function sleepMs(ms: number): Promise<void> {
  const v = Math.max(0, Math.trunc(ms));
  return new Promise((resolve) => setTimeout(resolve, v));
}

export function parseRetryAfterMs(headers: Headers): number | null {
  // Retry-After can be seconds or an HTTP date. We only support seconds here.
  const raw = headers.get("retry-after");
  if (!raw) return null;
  const s = raw.trim();
  const n = Number(s);
  if (!Number.isFinite(n)) return null;
  if (n <= 0) return 0;
  return Math.trunc(n * 1000);
}

export function expBackoffMs(attemptIndex: number, opts?: { baseMs?: number; maxMs?: number }): number {
  const baseMs = opts?.baseMs ?? 250;
  const maxMs = opts?.maxMs ?? 8_000;
  const pow = Math.min(10, Math.max(0, Math.trunc(attemptIndex)));
  const raw = baseMs * Math.pow(2, pow);
  // Full jitter.
  const jittered = Math.random() * raw;
  return Math.trunc(Math.min(maxMs, Math.max(0, jittered)));
}

export function envInt(name: string, def: number): number {
  const raw = process.env[name];
  if (!raw) return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.trunc(n);
}

