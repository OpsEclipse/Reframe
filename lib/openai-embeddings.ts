import { fetchWithTimeout, isAbortError } from "@/lib/fetch-with-timeout";
import { HttpError } from "@/lib/http-error";
import { getOpenAIRateGate, getOpenAISemaphore } from "@/lib/llm-concurrency";
import { logEvent } from "@/lib/log";
import { envInt, expBackoffMs, parseRetryAfterMs, sleepMs } from "@/lib/retry";

type OpenAIEmbeddingsRequest = {
  model: string;
  input: string | string[];
  encoding_format?: "float" | "base64";
  dimensions?: number;
  user?: string;
};

type OpenAIEmbeddingsResponse = {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
};

function envTimeoutMs(name: string, def: number): number {
  const raw = process.env[name];
  if (!raw) return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.trunc(n);
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getBaseUrl(): string {
  const raw = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  return raw.replace(/\/+$/, "");
}

type EmbeddingCacheEntry = { expiresAt: number; model: string; embedding: number[] };

const embeddingCache = new Map<string, EmbeddingCacheEntry>();
const embeddingInflight = new Map<string, Promise<{ model: string; embedding: number[] }>>();

export async function openaiEmbedText(
  input: string,
  opts?: { model?: string; dimensions?: number; requestId?: string; purpose?: string },
) {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const baseUrl = getBaseUrl();
  const model = opts?.model || process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";
  const timeoutMs = envTimeoutMs("OPENAI_TIMEOUT_MS", 20_000);
  const maxRetries = Math.max(0, envInt("OPENAI_MAX_RETRIES", 2));
  const cacheTtlMs = Math.max(0, envInt("OPENAI_EMBED_CACHE_TTL_MS", 300_000));
  const cacheMax = Math.max(1, envInt("OPENAI_EMBED_CACHE_MAX", 50));

  const cacheKey = `${model}::${typeof opts?.dimensions === "number" ? opts.dimensions : ""}::${input}`;
  if (cacheTtlMs > 0) {
    const cached = embeddingCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logEvent("info", "embeddings.cache_hit", {
        requestId: opts?.requestId,
        model,
        ttlMs: cacheTtlMs,
      });
      return { model: cached.model, embedding: cached.embedding };
    }
    if (cached) embeddingCache.delete(cacheKey);

    const inflight = embeddingInflight.get(cacheKey);
    if (inflight) {
      logEvent("info", "embeddings.inflight_join", {
        requestId: opts?.requestId,
        model,
      });
      return await inflight;
    }
  }

  const body: OpenAIEmbeddingsRequest = {
    model,
    input,
    encoding_format: "float",
  };
  if (typeof opts?.dimensions === "number") body.dimensions = opts.dimensions;

  const run = async (): Promise<{ model: string; embedding: number[] }> => {
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
              purpose: opts?.purpose || "embeddings",
              waitMs,
            });
          }
          const rateWaitMs = await getOpenAIRateGate().wait();
          if (rateWaitMs >= 25) {
            logEvent("info", "llm.rate_wait", {
              requestId: opts?.requestId,
              provider: "openai",
              purpose: opts?.purpose || "embeddings",
              waitMs: rateWaitMs,
            });
          }
          res = await fetchWithTimeout(
            `${baseUrl}/embeddings`,
            {
              method: "POST",
              headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify(body),
            },
            { timeoutMs },
          );
        } finally {
          release();
        }
      } catch (e) {
        if (isAbortError(e)) {
          lastErr = new Error("OpenAI embeddings request timed out");
        } else {
          lastErr = e;
        }
        if (attempt < maxRetries) {
          await sleepMs(expBackoffMs(attempt));
          continue;
        }
        throw lastErr instanceof Error ? lastErr : new Error("OpenAI embeddings request failed");
      }

      const text = await res.text();
      let json: OpenAIEmbeddingsResponse | null = null;
      try {
        json = JSON.parse(text) as OpenAIEmbeddingsResponse;
      } catch {
        // fall through
      }

      if (!res.ok) {
        const retryAfterMs = parseRetryAfterMs(res.headers) ?? undefined;
        const msg = json?.error?.message || text || `HTTP ${res.status}`;
        const err = new HttpError({
          provider: "openai",
          status: res.status,
          retryAfterMs,
          message: `OpenAI embeddings error (HTTP ${res.status}): ${msg}`,
        });
        lastErr = err;

        const retryable = res.status === 429 || (res.status >= 500 && res.status <= 599);
        if (retryable && attempt < maxRetries) {
          const delay = Math.min(10_000, retryAfterMs ?? expBackoffMs(attempt));
          logEvent("warn", "llm.retry", {
            requestId: opts?.requestId,
            provider: "openai",
            purpose: opts?.purpose || "embeddings",
            attempt,
            status: res.status,
            delayMs: delay,
            model,
          });
          await sleepMs(delay);
          continue;
        }
        throw err;
      }

      const embedding = json?.data?.[0]?.embedding;
      if (!Array.isArray(embedding) || embedding.length === 0) {
        throw new Error("OpenAI embeddings returned empty embedding");
      }

      return { model, embedding };
    }

    throw lastErr instanceof Error ? lastErr : new Error("OpenAI embeddings request failed");
  };

  if (cacheTtlMs <= 0) return await run();

  if (embeddingCache.size > cacheMax) embeddingCache.clear();

  const promise = run();
  embeddingInflight.set(cacheKey, promise);
  try {
    const { model: m, embedding } = await promise;
    embeddingCache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, model: m, embedding });
    return { model: m, embedding };
  } finally {
    embeddingInflight.delete(cacheKey);
  }
}
