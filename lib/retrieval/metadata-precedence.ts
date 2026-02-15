import { ALLOWED_EMOTIONS, type AllowedEmotion, type GatekeeperMetadata } from "@/lib/gatekeeper";
import type { PineconeMatch } from "@/lib/pinecone-rest";

export type RetrievalFacets = Pick<GatekeeperMetadata, "emotions" | "people" | "keywords" | "date_int">;

export type MatchReasons = {
  emotions: AllowedEmotion[];
  people: string[];
  keywords: string[];
};

export type PrecedenceScore = {
  avgCoverage: number;
  facetMatchedCount: number;
  totalHits: number;
  pineconeScore: number;
};

export type RankedChunk = {
  id: string;
  pineconeScore: number;
  metadata?: Record<string, unknown>;
  match_reasons: MatchReasons;
  precedence: PrecedenceScore;
};

function uniq<T>(values: T[]): T[] {
  return Array.from(new Set(values));
}

function normalizeLower(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const out: string[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    const s = v.trim().toLowerCase();
    if (!s) continue;
    out.push(s);
  }
  return uniq(out);
}

function normalizeEmotions(values: unknown): AllowedEmotion[] {
  if (!Array.isArray(values)) return [];
  const out: AllowedEmotion[] = [];
  for (const v of values) {
    if (typeof v !== "string") continue;
    if ((ALLOWED_EMOTIONS as readonly string[]).includes(v)) out.push(v as AllowedEmotion);
  }
  return uniq(out);
}

function intersect<T>(a: Set<T>, b: Set<T>): T[] {
  const out: T[] = [];
  for (const v of a) if (b.has(v)) out.push(v);
  return out;
}

function safeNumber(x: unknown): number {
  return typeof x === "number" && Number.isFinite(x) ? x : 0;
}

export function computeMetadataPrecedence(
  query: RetrievalFacets,
  match: PineconeMatch,
): RankedChunk {
  const pineconeScore = safeNumber(match.score);
  const meta = (match.metadata && typeof match.metadata === "object" ? match.metadata : undefined) as
    | Record<string, unknown>
    | undefined;

  const qEmotions = (query.emotions ?? []).filter(Boolean);
  const qPeople = normalizeLower(query.people);
  const qKeywords = normalizeLower(query.keywords);

  const mEmotions = normalizeEmotions(meta?.emotions);
  const mPeople = normalizeLower(meta?.people);
  const mKeywords = normalizeLower(meta?.keywords);

  const qEmotionSet = new Set(qEmotions);
  const qPeopleSet = new Set(qPeople);
  const qKeywordSet = new Set(qKeywords);

  const mEmotionSet = new Set(mEmotions);
  const mPeopleSet = new Set(mPeople);
  const mKeywordSet = new Set(mKeywords);

  const emotionHits = intersect(qEmotionSet, mEmotionSet) as AllowedEmotion[];
  const peopleHits = intersect(qPeopleSet, mPeopleSet);
  const keywordHits = intersect(qKeywordSet, mKeywordSet);

  const emotionCoverage = qEmotions.length ? emotionHits.length / qEmotions.length : 0;
  const peopleCoverage = qPeople.length ? peopleHits.length / qPeople.length : 0;
  const keywordCoverage = qKeywords.length ? keywordHits.length / qKeywords.length : 0;

  const presentCoverages: number[] = [];
  if (qEmotions.length) presentCoverages.push(emotionCoverage);
  if (qPeople.length) presentCoverages.push(peopleCoverage);
  if (qKeywords.length) presentCoverages.push(keywordCoverage);
  const avgCoverage = presentCoverages.length
    ? presentCoverages.reduce((a, b) => a + b, 0) / presentCoverages.length
    : 0;

  const facetMatchedCount =
    (emotionHits.length ? 1 : 0) + (peopleHits.length ? 1 : 0) + (keywordHits.length ? 1 : 0);

  const totalHits = emotionHits.length + peopleHits.length + keywordHits.length;

  return {
    id: match.id,
    pineconeScore,
    metadata: meta,
    match_reasons: {
      emotions: emotionHits,
      people: peopleHits,
      keywords: keywordHits,
    },
    precedence: {
      avgCoverage,
      facetMatchedCount,
      totalHits,
      pineconeScore,
    },
  };
}

function compareDesc(a: number, b: number): number {
  if (a === b) return 0;
  return a > b ? -1 : 1;
}

export function rankByMetadataPrecedence(query: RetrievalFacets, matches: PineconeMatch[]): RankedChunk[] {
  const scored = matches.map((m) => computeMetadataPrecedence(query, m));
  scored.sort((a, b) => {
    const pA = a.precedence;
    const pB = b.precedence;
    const c1 = compareDesc(pA.avgCoverage, pB.avgCoverage);
    if (c1) return c1;
    const c2 = compareDesc(pA.facetMatchedCount, pB.facetMatchedCount);
    if (c2) return c2;
    const c3 = compareDesc(pA.totalHits, pB.totalHits);
    if (c3) return c3;
    return compareDesc(pA.pineconeScore, pB.pineconeScore);
  });
  return scored;
}
