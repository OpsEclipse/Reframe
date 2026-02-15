type LogLevel = "info" | "warn" | "error";

function isEnabled(): boolean {
  return process.env.LOG_LLM === "1" || process.env.CHAT_DEBUG === "1";
}

function safeString(x: unknown): string | undefined {
  if (typeof x !== "string") return undefined;
  const s = x.trim();
  return s ? s : undefined;
}

export function logEvent(
  level: LogLevel,
  event: string,
  fields: Record<string, unknown> & { requestId?: string },
) {
  if (!isEnabled()) return;
  const payload = {
    ts: new Date().toISOString(),
    level,
    event,
    ...fields,
    requestId: safeString(fields.requestId),
  };
  if (level === "error") console.error(JSON.stringify(payload));
  else if (level === "warn") console.warn(JSON.stringify(payload));
  else console.log(JSON.stringify(payload));
}
