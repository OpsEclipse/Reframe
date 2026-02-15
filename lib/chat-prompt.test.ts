import { describe, expect, it } from "vitest";
import { buildTopChunksForPrompt } from "@/lib/chat-prompt";
import type { RankedChunk } from "@/lib/retrieval/metadata-precedence";

function mkChunk(id: string, textLen: number): RankedChunk {
  return {
    id,
    pineconeScore: 0.9,
    metadata: {
      title: `T ${id}`,
      source: "S",
      text: "x".repeat(textLen),
      noisy: { nested: true },
      arr: Array.from({ length: 50 }, (_, i) => `v${i}`),
    },
    match_reasons: { emotions: [], people: [], keywords: [] },
    precedence: { avgCoverage: 0, facetMatchedCount: 0, totalHits: 0, pineconeScore: 0.9 },
  };
}

describe("buildTopChunksForPrompt", () => {
  it("caps at 12 even if more are provided", () => {
    const chunks = Array.from({ length: 25 }, (_, i) => mkChunk(`c${i}`, 10));
    const out = buildTopChunksForPrompt(chunks, 25);
    expect(out).toHaveLength(12);
    expect(out[0]?.id).toBe("c0");
    expect(out[11]?.id).toBe("c11");
  });

  it("truncates preview to <= 801 chars (including ellipsis)", () => {
    const chunks = [mkChunk("c1", 5000)];
    const out = buildTopChunksForPrompt(chunks, 12);
    expect(out[0]?.preview?.length).toBeLessThanOrEqual(801);
  });

  it("sanitizes metadata (drops nested objects and caps arrays)", () => {
    const chunks = [mkChunk("c1", 5)];
    const out = buildTopChunksForPrompt(chunks, 12);
    const meta = out[0]?.metadata;
    expect(meta && typeof meta === "object").toBe(true);
    const metaRecord = meta as Record<string, unknown>;
    expect(metaRecord.noisy).toBeUndefined();
    expect(Array.isArray(metaRecord.arr)).toBe(true);
    expect((metaRecord.arr as unknown[]).length).toBeLessThanOrEqual(12);
  });
});
