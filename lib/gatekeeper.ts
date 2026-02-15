import { groqChatCompletion } from "@/lib/groq-client";
import { openaiChatCompletion } from "@/lib/openai-client";
import { envInt } from "@/lib/retry";
import { logEvent } from "@/lib/log";

type GatekeeperCacheEntry = { expiresAt: number; value: GatekeeperMetadata };

const gatekeeperCache = new Map<string, GatekeeperCacheEntry>();
const gatekeeperInflight = new Map<string, Promise<GatekeeperMetadata>>();

export const ALLOWED_EMOTIONS = [
  "Joy",
  "Anger",
  "Gratitude",
  "Sadness",
  "Anxiety",
  "Guilt",
  "Loneliness",
  "Awe",
  "Neutral",
] as const;

export type AllowedEmotion = (typeof ALLOWED_EMOTIONS)[number];

export type GatekeeperMetadata = {
  // True when the user query should NOT trigger retrieval (RAG).
  // Example: greetings, small talk, or requests unrelated to the corpus.
  skip_RAG: boolean;
  // Null unless reframing is needed for retrieval.
  reframed_query: string | null;
  // Null unless at least one emotion is clearly expressed.
  emotions: AllowedEmotion[] | null;
  // Null unless specific person names are mentioned.
  people: string[] | null;
  // Null unless keywords are explicitly present / clearly inferable from the query.
  keywords: string[] | null;
  // YYYYMMDD integer when a specific date is clearly present; otherwise null.
  date_int: number | null;
};

export type GatekeeperInput = {
  query: string;
  timezone?: string; // IANA tz, e.g. "America/Los_Angeles"
  todayOverride?: string; // YYYY-MM-DD, for deterministic tests/calls
  requestId?: string; // logging/correlation only
};

function yyyymmddFromISODate(dateIso: string): number | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateIso);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  if (y < 1900 || y > 2100) return null;
  if (mo < 1 || mo > 12) return null;
  if (d < 1 || d > 31) return null;
  return y * 10000 + mo * 100 + d;
}

function todayInTimezone(timezone?: string): string {
  // Returns YYYY-MM-DD.
  // If timezone is invalid, fall back to UTC.
  const tz = timezone || "UTC";
  try {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(new Date()); // en-CA => YYYY-MM-DD
  } catch {
    const fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone: "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return fmt.format(new Date());
  }
}

function extractJsonObject(text: string): unknown {
  // Prefer full parse; if the model wrapped JSON in text, extract first {...} block.
  try {
    return JSON.parse(text);
  } catch {
    // fall through
  }

  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) {
    throw new Error("Gatekeeper returned non-JSON output");
  }
  const slice = text.slice(start, end + 1);
  try {
    return JSON.parse(slice);
  } catch {
    throw new Error("Gatekeeper returned invalid JSON");
  }
}

function isAllowedEmotion(x: unknown): x is AllowedEmotion {
  return typeof x === "string" && (ALLOWED_EMOTIONS as readonly string[]).includes(x);
}

function normalizeStringArray(x: unknown): string[] | null {
  if (!Array.isArray(x)) return null;
  const out: string[] = [];
  for (const v of x) {
    if (typeof v !== "string") continue;
    const s = v.trim();
    if (!s) continue;
    out.push(s);
  }
  return out.length ? out : null;
}

function uniqCaseInsensitive(values: string[] | null): string[] | null {
  if (!values || values.length === 0) return null;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const v of values) {
    const key = v.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(v);
  }
  return out.length ? out : null;
}

function validateGatekeeperMetadata(raw: unknown): GatekeeperMetadata {
  if (!raw || typeof raw !== "object") throw new Error("Gatekeeper JSON must be an object");
  const r = raw as Record<string, unknown>;

  let skip_RAG = false;
  if (typeof r.skip_RAG === "boolean") {
    skip_RAG = r.skip_RAG;
  } else if (typeof r.skip_RAG === "string") {
    const v = r.skip_RAG.trim().toLowerCase();
    if (v === "true") skip_RAG = true;
    if (v === "false") skip_RAG = false;
  } else if (typeof r.skip_RAG === "number") {
    // Be forgiving if the model emits 0/1.
    if (r.skip_RAG === 1) skip_RAG = true;
    if (r.skip_RAG === 0) skip_RAG = false;
  }

  const reframed_query =
    r.reframed_query === null
      ? null
      : typeof r.reframed_query === "string" && r.reframed_query.trim()
        ? r.reframed_query.trim()
        : null;

  let emotions: AllowedEmotion[] | null = null;
  if (r.emotions === null) {
    emotions = null;
  } else if (Array.isArray(r.emotions)) {
    const filtered = r.emotions.filter(isAllowedEmotion) as AllowedEmotion[];
    emotions = filtered.length ? Array.from(new Set(filtered)) : null;
  } else {
    emotions = null;
  }

  const people = r.people === null ? null : uniqCaseInsensitive(normalizeStringArray(r.people));

  let keywords = r.keywords === null ? null : uniqCaseInsensitive(normalizeStringArray(r.keywords));
  // Keep people out of keywords if the model included them redundantly.
  if (people && keywords) {
    const peopleSet = new Set(people.map((p) => p.toLowerCase()));
    keywords = keywords.filter((k) => !peopleSet.has(k.toLowerCase()));
    if (keywords.length === 0) keywords = null;
  }

  let date_int: number | null = null;
  if (r.date_int === null || typeof r.date_int === "undefined") {
    date_int = null;
  } else if (typeof r.date_int === "number" && Number.isInteger(r.date_int)) {
    // Basic sanity: 8-digit YYYYMMDD.
    if (r.date_int >= 19000101 && r.date_int <= 21001231) date_int = r.date_int;
  } else if (typeof r.date_int === "string") {
    const n = Number(r.date_int);
    if (Number.isInteger(n) && n >= 19000101 && n <= 21001231) date_int = n;
  }

  return { skip_RAG, reframed_query, emotions, people, keywords, date_int };
}

export function parseGatekeeperMetadata(raw: unknown): GatekeeperMetadata {
  return validateGatekeeperMetadata(raw);
}

export async function gatekeepQuery(input: GatekeeperInput): Promise<GatekeeperMetadata> {
  const query = input.query?.trim();
  if (!query) throw new Error("query is required");

  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;
  if (!hasOpenAI && !hasGroq) {
    throw new Error("Missing required env var: OPENAI_API_KEY (preferred) or GROQ_API_KEY (fallback)");
  }

  // Gatekeeper primary model: OpenAI GPT-4o mini by default.
  // Groq is kept as a fallback provider.
  const primaryModel = (process.env.GATEKEEPER_MODEL || "").trim() || "gpt-4o-mini";
  const fallbackModel =
    (process.env.GATEKEEPER_FALLBACK_MODEL || "").trim() ||
    (process.env.GROQ_MODEL || "").trim() ||
    "llama3-8b-8192";

  const todayIso = input.todayOverride || todayInTimezone(input.timezone);
  const todayInt = yyyymmddFromISODate(todayIso);
  const todayLine = todayInt ? `${todayIso} (date_int=${todayInt})` : todayIso;

  const cacheTtlMs = Math.max(0, envInt("GATEKEEPER_CACHE_TTL_MS", 60_000));
  const cacheMax = Math.max(1, envInt("GATEKEEPER_CACHE_MAX", 500));
  const cacheKey = `${primaryModel}::${fallbackModel}::${input.timezone || ""}::${todayIso}::${query}`;
  if (cacheTtlMs > 0) {
    const cached = gatekeeperCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      logEvent("info", "gatekeeper.cache_hit", {
        requestId: input.requestId,
        ttlMs: cacheTtlMs,
      });
      return cached.value;
    }
    if (cached) gatekeeperCache.delete(cacheKey);

    const inflight = gatekeeperInflight.get(cacheKey);
    if (inflight) {
      logEvent("info", "gatekeeper.inflight_join", { requestId: input.requestId });
      return await inflight;
    }
  }

  const system = [
    "You are Gatekeeper.",
    "Task: Extract metadata from the user's query for retrieval.",
    "Return ONLY a single JSON object and nothing else.",
    "",
    "Schema (all keys required; use null when not present):",
    '{ "skip_RAG": boolean, "reframed_query": string|null, "emotions": string[]|null, "people": string[]|null, "keywords": string[]|null, "date_int": number|null }',
    "",
    "Emotion definitions (choose from the allowed list only; use these meanings):",
    "- Joy: wins, celebrations, excitement, or general happiness.",
    "- Anger: venting, frustration, irritation, or feeling furious/wronged.",
    "- Gratitude: thankfulness, appreciation, or reflecting on what you're grateful for (distinct from simple joy).",
    "- Sadness: grief, loss, disappointment, or low-energy \"down\" days.",
    "- Anxiety: worry/unease about the future, uncertainty, or safety; persistent \"what if\" thinking (distinguish worry from simple fear).",
    "- Guilt: remorse, self-blame, or moral conflict about actions/choices.",
    "- Loneliness: social disconnection, isolation, or longing for connection/belonging.",
    "- Awe: wonder/amazement from nature, travel, beauty, or deep \"aha\" moments.",
    "- Neutral: factual/log-like entries with no clear emotional valence (e.g., \"I went to the store, then home\").",
    "",
    "Rules:",
    "- skip_RAG: set to true ONLY when the query should not run retrieval (RAG), e.g. greetings/small-talk/pleasantries or requests unrelated to the corpus. Otherwise false.",
    "- If skip_RAG is true, set reframed_query/emotions/people/keywords/date_int to null.",
    `- emotions: only choose from this exact list: ${ALLOWED_EMOTIONS.join(", ")}.`,
    "- emotions must be null unless at least one emotion is clearly expressed.",
    "- If the text is explicitly factual/log-like with no emotional valence, you may return emotions: [\"Neutral\"]. Otherwise, prefer null over guessing.",
    "- people: list of specific person names mentioned in the query (e.g. \"Sarah\"). If no names, return null. Do not put people into keywords.",
    "- keywords must be null unless there are clear keywords in the query; otherwise return 3-12 concise keywords/phrases.",
    "- reframed_query: if the query is already a good standalone retrieval query, return null; otherwise rewrite it into a short standalone retrieval query.",
    "- date_int: if the query clearly references a specific date (explicit or relative like today/yesterday/tomorrow), return YYYYMMDD as an integer; otherwise null.",
    "- Do not guess missing metadata. If uncertain, return null.",
    "",
    `Context: today's date in the user's timezone is ${todayLine}. Timezone: ${input.timezone || "unspecified"}.`,
  ].join("\n");

  const baseReq = {
    temperature: 0,
    max_tokens: 250,
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: query },
    ],
  };

  const run = async (): Promise<GatekeeperMetadata> => {
    // Try OpenAI first when available, then fall back to Groq.
    // Note: JSON mode isn't guaranteed for every model/provider; retry without response_format when rejected.
    let completion: { content: string } | null = null;
    let lastErr: unknown = null;
    let usedProvider: "openai" | "groq" | null = null;

    if (hasOpenAI) {
      try {
        completion = await openaiChatCompletion(
          { ...baseReq, model: primaryModel, response_format: { type: "json_object" } },
          { maxRetries: 0, requestId: input.requestId, purpose: "gatekeeper" }, // prefer fast fallback to Groq on rate limits
        );
        usedProvider = "openai";
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.toLowerCase().includes("response_format") || msg.toLowerCase().includes("json_object")) {
          try {
            completion = await openaiChatCompletion(
              { ...baseReq, model: primaryModel },
              { maxRetries: 0, requestId: input.requestId, purpose: "gatekeeper" },
            );
            usedProvider = "openai";
          } catch (e2) {
            lastErr = e2;
          }
        } else {
          lastErr = e;
        }
      }
    }

    if (!completion && hasGroq) {
      if (hasOpenAI && lastErr) {
        logEvent("warn", "gatekeeper.fallback", {
          requestId: input.requestId,
          from: "openai",
          to: "groq",
          primaryModel,
          fallbackModel,
          error: lastErr instanceof Error ? lastErr.message : String(lastErr),
        });
      }
      try {
        completion = await groqChatCompletion({
          ...baseReq,
          model: fallbackModel,
          response_format: { type: "json_object" },
        }, { requestId: input.requestId, purpose: "gatekeeper_fallback" });
        usedProvider = "groq";
      } catch (e) {
        const msg = e instanceof Error ? e.message : "";
        if (msg.toLowerCase().includes("response_format") || msg.toLowerCase().includes("json_object")) {
          try {
            completion = await groqChatCompletion(
              { ...baseReq, model: fallbackModel },
              { requestId: input.requestId, purpose: "gatekeeper_fallback" },
            );
            usedProvider = "groq";
          } catch (e2) {
            lastErr = e2;
          }
        } else {
          lastErr = e;
        }
      }
    }

    if (!completion) throw (lastErr instanceof Error ? lastErr : new Error("Gatekeeper LLM request failed"));

    logEvent("info", "gatekeeper.complete", {
      requestId: input.requestId,
      primaryModel,
      fallbackModel,
      usedProvider,
    });

    const raw = extractJsonObject(completion.content);
    return parseGatekeeperMetadata(raw);
  };

  if (cacheTtlMs <= 0) return await run();

  if (gatekeeperCache.size > cacheMax) gatekeeperCache.clear();

  const promise = run();
  gatekeeperInflight.set(cacheKey, promise);
  try {
    const value = await promise;
    gatekeeperCache.set(cacheKey, { expiresAt: Date.now() + cacheTtlMs, value });
    return value;
  } finally {
    gatekeeperInflight.delete(cacheKey);
  }
}
