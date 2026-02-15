import { z } from "zod";

// Structured output designed to map 1:1 to the /reflect layout (Figma 36:3830 / 36:3911).
export const ArchiveReflectionSchema = z.object({
  greeting: z.string(),
  anchor_line: z.object({
    before: z.string(),
    highlight: z.string(),
    after: z.string().default("."),
  }),
  lines: z.array(z.string()).max(6).default([]),
  transition: z.string(),
  timeline: z
    .array(
      z.object({
        periodLabel: z.string(),
        entriesCountLabel: z.string(),
        content: z.string(),
        source_id: z.string().nullable(),
        reframe: z.string().nullable(),
      }),
    )
    .max(8)
    .default([]),
  conclusion: z.string(),
  pattern: z.array(z.string()).max(4).default([]),
  question: z.string(),
  // Returned for audit/debug and later UI (no floating card required).
  sources: z
    .array(
      z.object({
        id: z.string(),
        title: z.string().nullable().optional(),
        source: z.string().nullable().optional(),
        score: z.number().nullable(),
        preview: z.string().nullable().optional(),
      }),
    )
    .max(8)
    .default([]),
});

export type ArchiveReflection = z.infer<typeof ArchiveReflectionSchema>;

function cleanString(x: unknown): string {
  return typeof x === "string" ? x.trim() : "";
}

function shouldInsertSpaceBetween(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (/\s$/.test(left) || /^\s/.test(right)) return false;
  // Avoid inserting a space before punctuation that typically doesn't take a leading space.
  if (/^[.,;:!?)]/.test(right)) return false;
  // Avoid inserting a space after opening brackets.
  if (/[([{]$/.test(left)) return false;
  return true;
}

function normalizeAnchorLineSegments(anchor: {
  before: string;
  highlight: string;
  after: string;
}): { before: string; highlight: string; after: string } {
  let before = anchor.before;
  let after = anchor.after;

  if (shouldInsertSpaceBetween(before, anchor.highlight)) before = `${before} `;
  if (shouldInsertSpaceBetween(anchor.highlight, after)) after = ` ${after}`;

  return { before, highlight: anchor.highlight, after };
}

function uniqById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    const id = cleanString(it?.id);
    if (!id) continue;
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({ ...it, id } as T);
  }
  return out;
}

/**
 * Server-side hardening for model output.
 * Note: This does not run during token streaming; it's for validating/sanitizing completed objects
 * in tests and for future use (e.g. when persisting reflections).
 */
export function sanitizeArchiveReflection(
  raw: ArchiveReflection,
  opts: { validSourceIds: string[] },
): ArchiveReflection {
  const valid = new Set(opts.validSourceIds);

  const timeline = (raw.timeline ?? [])
    .slice(0, 8)
    .map((t) => {
      const source_id = t.source_id && valid.has(t.source_id) ? t.source_id : null;
      return {
        periodLabel: cleanString(t.periodLabel),
        entriesCountLabel: cleanString(t.entriesCountLabel),
        content: cleanString(t.content),
        source_id,
        // Quotes are optional; to avoid invented text, keep them null unless a valid source is cited.
        reframe: source_id ? (t.reframe ? cleanString(t.reframe) : null) : null,
      };
    });

  const sources = uniqById(raw.sources ?? [])
    .filter((s) => valid.has(s.id))
    .slice(0, 8)
    .map((s) => ({
      id: cleanString(s.id),
      title: typeof s.title === "string" ? s.title.trim() : s.title ?? null,
      source: typeof s.source === "string" ? s.source.trim() : s.source ?? null,
      score: typeof s.score === "number" && Number.isFinite(s.score) ? s.score : null,
      preview: typeof s.preview === "string" ? s.preview.trim() : s.preview ?? null,
    }));

  return {
    greeting: cleanString(raw.greeting),
    anchor_line: normalizeAnchorLineSegments({
      before: cleanString(raw.anchor_line?.before),
      highlight: cleanString(raw.anchor_line?.highlight),
      after: cleanString(raw.anchor_line?.after) || ".",
    }),
    lines: (raw.lines ?? []).slice(0, 6).map(cleanString).filter(Boolean),
    transition: cleanString(raw.transition),
    timeline,
    conclusion: cleanString(raw.conclusion),
    pattern: (raw.pattern ?? []).slice(0, 4).map(cleanString).filter(Boolean),
    question: cleanString(raw.question),
    sources,
  };
}
