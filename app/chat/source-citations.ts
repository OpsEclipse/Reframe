import type { SourceCitation } from "@/lib/rag-answer";

export function normalizeSourceCitations(input: unknown): SourceCitation[] {
  if (!Array.isArray(input)) return [];
  const seen = new Set<string>();
  const out: SourceCitation[] = [];
  for (const v of input) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const r = v as Record<string, unknown>;
    const id = typeof r.id === "string" ? r.id.trim() : "";
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      title: typeof r.title === "string" ? r.title : (r.title === null ? null : undefined),
      source: typeof r.source === "string" ? r.source : (r.source === null ? null : undefined),
      score: typeof r.score === "number" && Number.isFinite(r.score) ? r.score : null,
      preview: typeof r.preview === "string" ? r.preview : (r.preview === null ? null : undefined),
      metadata: (r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata))
        ? (r.metadata as Record<string, unknown>)
        : undefined,
    });
  }
  return out;
}

