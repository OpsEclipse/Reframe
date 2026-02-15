import type { GatekeeperMetadata } from "@/lib/gatekeeper";
import { openaiEmbedText } from "@/lib/openai-embeddings";
import { pineconeQuery, type PineconeMatch } from "@/lib/pinecone-rest";
import {
  rankByMetadataPrecedence,
  type RetrievalFacets,
  type RankedChunk,
} from "@/lib/retrieval/metadata-precedence";
import {
  FACET_LIMITS,
  sanitizeEmotions,
  sanitizeLowercaseStrings,
  toNullable,
} from "@/lib/retrieval/sanitize-facets";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_QUERY_EMBEDDING_DIMS = 4096;

type RetrieveRequest = {
  query: string;
  gatekeeper: Pick<GatekeeperMetadata, "reframed_query" | "emotions" | "people" | "keywords" | "date_int">;
  queryEmbedding?: number[];
  top_k?: number;
  base_top_k?: number;
  matched_top_k?: number;
  blend_ratio?: number;
  namespace?: string;
};

function clampInt(n: unknown, def: number, min: number, max: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return def;
  const v = Math.trunc(n);
  if (v < min) return min;
  if (v > max) return max;
  return v;
}

function clampRatio(n: unknown, def: number): number {
  if (typeof n !== "number" || !Number.isFinite(n)) return def;
  if (n <= 0) return 0;
  if (n >= 1) return 1;
  return n;
}

function buildFacetOrFilter(facets: RetrievalFacets): Record<string, unknown> | null {
  const or: Record<string, unknown>[] = [];
  const emotions = facets.emotions ?? [];
  const people = facets.people ?? [];
  const keywords = facets.keywords ?? [];

  if (emotions.length) or.push({ emotions: { $in: emotions } });
  if (people.length) or.push({ people: { $in: people } });
  if (keywords.length) or.push({ keywords: { $in: keywords } });

  if (!or.length) return null;
  return { $or: or };
}

function isNonEmptyNumberArray(x: unknown): x is number[] {
  if (!Array.isArray(x) || x.length === 0) return false;
  if (x.length > MAX_QUERY_EMBEDDING_DIMS) return false;
  for (const v of x) {
    if (typeof v !== "number" || !Number.isFinite(v)) return false;
  }
  return true;
}

function pickQueryText(query: string, gatekeeper: { reframed_query: string | null }): string {
  const reframed = typeof gatekeeper.reframed_query === "string" ? gatekeeper.reframed_query.trim() : "";
  return reframed ? reframed : query.trim();
}

function mergeMatches(base: PineconeMatch[], matched: PineconeMatch[]): PineconeMatch[] {
  const byId = new Map<string, PineconeMatch>();

  const upsert = (m: PineconeMatch) => {
    const id = m.id;
    const prev = byId.get(id);
    if (!prev) {
      byId.set(id, { id, score: m.score, metadata: m.metadata });
      return;
    }
    const prevScore = typeof prev.score === "number" ? prev.score : 0;
    const nextScore = typeof m.score === "number" ? m.score : 0;
    const score = Math.max(prevScore, nextScore);
    byId.set(id, {
      id,
      score,
      metadata: (m.metadata && typeof m.metadata === "object" ? m.metadata : prev.metadata) as
        | Record<string, unknown>
        | undefined,
    });
  };

  for (const m of base) upsert(m);
  for (const m of matched) upsert(m);

  return Array.from(byId.values());
}

export async function POST(req: Request) {
  let body: RetrieveRequest | null = null;
  try {
    body = (await req.json()) as RetrieveRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) return Response.json({ error: "`query` (string) is required" }, { status: 400 });

  const gatekeeper = body?.gatekeeper;
  if (!gatekeeper || typeof gatekeeper !== "object") {
    return Response.json({ error: "`gatekeeper` object is required" }, { status: 400 });
  }

  // If the caller sends a massive queryEmbedding, reject before scanning/using it.
  const qe = (body as RetrieveRequest | null)?.queryEmbedding;
  if (Array.isArray(qe) && qe.length > MAX_QUERY_EMBEDDING_DIMS) {
    return Response.json(
      { error: `\`queryEmbedding\` exceeds max dims (${MAX_QUERY_EMBEDDING_DIMS})` },
      { status: 400 },
    );
  }

  // Do not trust facets from the request body: sanitize to strings, validate emotions, and cap sizes.
  const gate = gatekeeper as Record<string, unknown>;
  const emotions = toNullable(sanitizeEmotions(gate.emotions, FACET_LIMITS.emotions));
  const people = toNullable(sanitizeLowercaseStrings(gate.people, FACET_LIMITS.people));
  const keywords = toNullable(sanitizeLowercaseStrings(gate.keywords, FACET_LIMITS.keywords));

  const facets: RetrievalFacets = {
    emotions,
    people,
    keywords,
    date_int: typeof gatekeeper.date_int === "number" ? gatekeeper.date_int : null,
  };

  const topKFinal = clampInt(body?.top_k, 12, 1, 50);
  const baseTopK = clampInt(body?.base_top_k, 50, topKFinal, 200);
  const matchedTopK = clampInt(body?.matched_top_k, 50, topKFinal, 200);
  const blendRatio = clampRatio(body?.blend_ratio, 0.7);

  const rewritten_query = pickQueryText(query, { reframed_query: gatekeeper.reframed_query ?? null });

  try {
    let vector: number[] | null = null;
    if (isNonEmptyNumberArray(body?.queryEmbedding)) {
      vector = body!.queryEmbedding!;
    } else {
      const embedded = await openaiEmbedText(rewritten_query);
      vector = embedded.embedding;
    }

    const namespaceEnv = process.env.PINECONE_NAMESPACE;
    const namespace =
      typeof body?.namespace === "string" && body.namespace.trim()
        ? body.namespace.trim()
        : typeof namespaceEnv === "string" && namespaceEnv.trim()
          ? namespaceEnv.trim()
          : undefined;

    const matchedFilter = buildFacetOrFilter(facets);
    const shouldRunMatched = !!matchedFilter;

    const basePromise = pineconeQuery({
      vector,
      topK: baseTopK,
      namespace,
      includeMetadata: true,
    });
    const matchedPromise = shouldRunMatched
      ? pineconeQuery({
          vector,
          topK: matchedTopK,
          namespace,
          filter: matchedFilter ?? undefined,
          includeMetadata: true,
        })
      : Promise.resolve({ matches: [] as PineconeMatch[] });

    const [baseRes, matchedRes] = await Promise.all([basePromise, matchedPromise]);

    const unionMatches = mergeMatches(baseRes.matches, matchedRes.matches);
    const ranked = rankByMetadataPrecedence(facets, unionMatches);
    const rankedById = new Map<string, RankedChunk>(ranked.map((r) => [r.id, r]));

    const primaryCount = Math.min(ranked.length, Math.ceil(blendRatio * topKFinal));
    const out: RankedChunk[] = [];
    const seen = new Set<string>();

    for (const r of ranked.slice(0, primaryCount)) {
      out.push(r);
      seen.add(r.id);
      if (out.length >= topKFinal) break;
    }

    if (out.length < topKFinal) {
      for (const m of baseRes.matches) {
        if (!m || typeof m.id !== "string") continue;
        if (seen.has(m.id)) continue;
        const r = rankedById.get(m.id);
        if (!r) continue;
        out.push(r);
        seen.add(m.id);
        if (out.length >= topKFinal) break;
      }
    }

    return Response.json(
      {
        rewritten_query,
        stats: {
          top_k: topKFinal,
          blend_ratio: blendRatio,
          base_top_k: baseTopK,
          matched_top_k: matchedTopK,
          base_count: baseRes.matches.length,
          matched_count: matchedRes.matches.length,
          union_count: unionMatches.length,
        },
        chunks: out,
      },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
