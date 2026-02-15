import { fetchWithTimeout, isAbortError } from "@/lib/fetch-with-timeout";
import { HttpError } from "@/lib/http-error";
import { getOpenAISemaphore } from "@/lib/llm-concurrency";
import { logEvent } from "@/lib/log";
import { envInt, expBackoffMs, parseRetryAfterMs, sleepMs } from "@/lib/retry";

export type OpenAIChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type OpenAIChatCompletionRequest = {
  model: string;
  messages: OpenAIChatMessage[];
  temperature?: number;
  max_tokens?: number;
  response_format?: { type: "json_object" } | { type: string };
};

type OpenAIChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getBaseUrl(): string {
  const raw = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  return raw.replace(/\/+$/, "");
}

function envTimeoutMs(name: string, def: number): number {
  const raw = process.env[name];
  if (!raw) return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.trunc(n);
}

export async function openaiChatCompletion(
  req: OpenAIChatCompletionRequest,
  opts?: { maxRetries?: number; requestId?: string; purpose?: string },
): Promise<{ content: string; rawText: string }> {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const baseUrl = getBaseUrl();
  const timeoutMs = envTimeoutMs("OPENAI_TIMEOUT_MS", 20_000);

  const maxRetries = Math.max(0, typeof opts?.maxRetries === "number" ? Math.trunc(opts.maxRetries) : envInt("OPENAI_MAX_RETRIES", 2));

  let lastErr: unknown = null;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    let res: Response;
    try {
      const queueStart = Date.now();
      const release = await getOpenAISemaphore().acquire();
      try {
        const waitMs = Date.now() - queueStart;
        if (waitMs >= 25) {
          logEvent("info", "llm.queue_wait", {
            requestId: opts?.requestId,
            provider: "openai",
            purpose: opts?.purpose,
            waitMs,
          });
        }
        res = await fetchWithTimeout(
          `${baseUrl}/chat/completions`,
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${apiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(req),
          },
          { timeoutMs },
        );
      } finally {
        release();
      }
    } catch (e) {
      if (isAbortError(e)) {
        lastErr = new Error("OpenAI request timed out");
      } else {
        lastErr = e;
      }
      // Network/timeout: retry with backoff.
      if (attempt < maxRetries) {
        await sleepMs(expBackoffMs(attempt));
        continue;
      }
      throw lastErr instanceof Error ? lastErr : new Error("OpenAI request failed");
    }

    const rawText = await res.text();
    let json: OpenAIChatCompletionResponse | null = null;
    try {
      json = JSON.parse(rawText) as OpenAIChatCompletionResponse;
    } catch {
      // fall through
    }

      if (!res.ok) {
        const retryAfterMs = parseRetryAfterMs(res.headers) ?? undefined;
        const msg = json?.error?.message || rawText || `HTTP ${res.status}`;

        const err = new HttpError({
          provider: "openai",
          status: res.status,
          retryAfterMs,
          message: `OpenAI API error (HTTP ${res.status}): ${msg}`,
        });
        lastErr = err;

        const retryable = res.status === 429 || (res.status >= 500 && res.status <= 599);
        if (retryable && attempt < maxRetries) {
          const delay = Math.min(10_000, retryAfterMs ?? expBackoffMs(attempt));
          logEvent("warn", "llm.retry", {
            requestId: opts?.requestId,
            provider: "openai",
            purpose: opts?.purpose,
            attempt,
            status: res.status,
            delayMs: delay,
            model: req.model,
          });
          await sleepMs(delay);
          continue;
        }
        throw err;
      }

    const content = json?.choices?.[0]?.message?.content ?? null;
    if (!content) throw new Error("OpenAI API returned empty completion content");
    return { content, rawText };
  }

  throw lastErr instanceof Error ? lastErr : new Error("OpenAI request failed");
}
