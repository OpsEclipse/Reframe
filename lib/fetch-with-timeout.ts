type TimeoutOptions = {
  timeoutMs: number;
};

function normalizeTimeoutMs(timeoutMs: number): number {
  // Guardrails: keep timeouts reasonable to avoid accidental "infinite" hangs.
  if (!Number.isFinite(timeoutMs)) return 15_000;
  const v = Math.trunc(timeoutMs);
  if (v < 100) return 100;
  if (v > 120_000) return 120_000;
  return v;
}

export function isAbortError(e: unknown): boolean {
  if (!e || typeof e !== "object") return false;
  const anyErr = e as { name?: unknown; code?: unknown };
  // Node/undici uses AbortError; some environments also surface DOMException with name AbortError.
  return anyErr.name === "AbortError" || anyErr.code === "ABORT_ERR";
}

export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit,
  opts: TimeoutOptions,
): Promise<Response> {
  const timeoutMs = normalizeTimeoutMs(opts.timeoutMs);

  // Node 18+ supports AbortSignal.timeout().
  const maybeTimeout = (AbortSignal as unknown as { timeout?: (ms: number) => AbortSignal }).timeout;
  if (typeof maybeTimeout === "function") {
    return fetch(input, { ...init, signal: maybeTimeout(timeoutMs) });
  }

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  // Avoid keeping the process alive just for the timeout.
  (t as unknown as { unref?: () => void }).unref?.();

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(t);
  }
}

