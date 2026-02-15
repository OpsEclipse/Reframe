export function parseRetryAfterSeconds(message: string): number | null {
  // Example: "Please try again in 2.12s."
  const m = /try again in\\s+(\\d+(?:\\.\\d+)?)s/i.exec(message);
  if (!m) return null;
  const sec = Math.ceil(Number(m[1]));
  if (!Number.isFinite(sec) || sec <= 0) return null;
  return sec;
}

export function isRateLimitMessage(message: string): boolean {
  return message.toLowerCase().includes("rate limit");
}

export function retryAfterHeadersFromMessage(message: string): HeadersInit | undefined {
  const retryAfter = parseRetryAfterSeconds(message);
  return retryAfter ? { "Retry-After": String(retryAfter) } : undefined;
}

