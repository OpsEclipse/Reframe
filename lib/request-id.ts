function fallbackId(): string {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export function getOrCreateRequestId(req: Request): string {
  const existing = req.headers.get("x-request-id") || req.headers.get("x-correlation-id");
  if (existing && existing.trim()) return existing.trim();
  const anyCrypto = globalThis.crypto as unknown as { randomUUID?: () => string } | undefined;
  if (anyCrypto?.randomUUID) return anyCrypto.randomUUID();
  return fallbackId();
}

