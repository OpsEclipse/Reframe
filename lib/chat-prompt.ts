import type { RankedChunk } from "@/lib/retrieval/metadata-precedence";

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function pickFirstString(meta: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!meta) return null;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

export function extractChunkPreview(meta: Record<string, unknown> | undefined): string | null {
  return pickFirstString(meta, ["text", "content", "chunk", "excerpt", "body"]);
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}…`;
}

export type PromptChunk = {
  id: string;
  title: string | null;
  source: string | null;
  file: string | null;
  path: string | null;
  url: string | null;
  score: number;
  preview: string | null;
  metadata?: Record<string, unknown>;
};

function sanitizeMetadataForPrompt(meta: Record<string, unknown> | undefined): Record<string, unknown> | undefined {
  if (!meta) return undefined;
  const out: Record<string, unknown> = {};
  const keys = Object.keys(meta);
  const capKeys = 40;
  for (const k of keys.slice(0, capKeys)) {
    const v = meta[k];
    if (typeof v === "string") {
      out[k] = v.length > 240 ? `${v.slice(0, 240)}…` : v;
    } else if (typeof v === "number" || typeof v === "boolean" || v === null) {
      out[k] = v;
    } else if (Array.isArray(v)) {
      // Keep small arrays of primitives only.
      const trimmed = v.slice(0, 12).filter((x) => {
        const t = typeof x;
        return t === "string" || t === "number" || t === "boolean" || x === null;
      });
      out[k] = trimmed;
    } else {
      // Drop nested objects/functions to avoid prompt blowups.
      continue;
    }
  }
  return Object.keys(out).length ? out : undefined;
}

export function buildTopChunksForPrompt(chunks: RankedChunk[], topK: number): PromptChunk[] {
  const out: PromptChunk[] = [];
  const cap = Math.max(0, Math.min(12, Math.trunc(topK)));
  for (const c of chunks.slice(0, cap)) {
    const meta = isRecord(c.metadata) ? (c.metadata as Record<string, unknown>) : undefined;
    const preview = extractChunkPreview(meta);
    out.push({
      id: c.id,
      title: pickFirstString(meta, ["title"]) ?? null,
      source: pickFirstString(meta, ["source"]) ?? null,
      file: pickFirstString(meta, ["file"]) ?? null,
      path: pickFirstString(meta, ["path"]) ?? null,
      url: pickFirstString(meta, ["url"]) ?? null,
      score: typeof c.pineconeScore === "number" && Number.isFinite(c.pineconeScore) ? c.pineconeScore : 0,
      preview: preview ? truncate(preview, 800) : null,
      metadata: sanitizeMetadataForPrompt(meta),
    });
  }
  return out;
}

export function buildMainChatSystemPrompt(): string {
  return [
    "You are a helpful assistant.",
    "You must return ONLY a single JSON object and nothing else.",
    "",
    "Schema (keys required):",
    '{ "answer": string, "sources": Array<{ "id": string, "title"?: string|null, "source"?: string|null, "score": number|null, "preview"?: string|null }> }',
    "",
    "Rules:",
    "- Output must be valid JSON (no markdown, no leading/trailing prose).",
    "- The `sources` array must reference ONLY chunk `id`s provided in the input. If no chunks are relevant, return `sources: []`.",
    "- Prefer a small number of sources (0-6). Never invent sources.",
    "- `answer` should be plain text. Do not mention internal chunk ids.",
  ].join("\n");
}
