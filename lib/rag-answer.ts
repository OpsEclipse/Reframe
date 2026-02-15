import { parseModelJsonObject } from "@/lib/model-json";

export type SourceCitation = {
  id: string;
  title?: string | null;
  source?: string | null;
  score: number | null;
  preview?: string | null;
  metadata?: Record<string, unknown>;
};

export type ChatGenerateRequest = {
  query: string;
  // Optional, but hard-capped to 12 server-side.
  top_k?: number;
};

export type ChatGenerateDebug = {
  rewritten_query?: string;
  llm?: {
    provider_preference?: "auto" | "openai" | "groq";
    used_provider?: "openai" | "groq" | null;
    used_model?: string | null;
    primary_model?: string;
    fallback_model?: string;
  };
  gatekeeper?: {
    skip_RAG: boolean;
    reframed_query: string | null;
    emotions: string[] | null;
    people: string[] | null;
    keywords: string[] | null;
    date_int: number | null;
  };
  retrieval?: {
    rewritten_query?: string;
    stats?: Record<string, unknown>;
    chunks?: Array<Record<string, unknown>>;
  };
};

export type ChatGenerateResponse = {
  answer: string;
  sources: SourceCitation[];
  requestId?: string;
  debug?: ChatGenerateDebug;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function safeString(x: unknown): string | null {
  return typeof x === "string" && x.trim() ? x.trim() : null;
}

function safeNumberOrNull(x: unknown): number | null {
  return typeof x === "number" && Number.isFinite(x) ? x : null;
}

export function clampTopK(x: unknown, def: number): number {
  if (typeof x !== "number" || !Number.isFinite(x)) return def;
  const v = Math.trunc(x);
  if (v < 1) return 1;
  if (v > 12) return 12;
  return v;
}

export function parseChatGenerateModelOutput(rawText: string): { answer: string; sources: SourceCitation[] } {
  const parsed = parseModelJsonObject(rawText);

  if (!isRecord(parsed)) throw new Error("Model output JSON must be an object");
  const answer = safeString(parsed.answer) ?? "";
  const rawSources = (parsed as Record<string, unknown>).sources;

  const sourcesOut: SourceCitation[] = [];
  if (Array.isArray(rawSources)) {
    for (const s of rawSources) {
      if (!isRecord(s)) continue;
      const id = safeString(s.id);
      if (!id) continue;
      const meta = isRecord(s.metadata) ? (s.metadata as Record<string, unknown>) : undefined;
      sourcesOut.push({
        id,
        title: safeString(s.title),
        source: safeString(s.source),
        score: safeNumberOrNull(s.score),
        preview: safeString(s.preview),
        metadata: meta,
      });
    }
  }

  return { answer, sources: sourcesOut };
}
