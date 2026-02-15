import { describe, expect, it } from "vitest";
import { runRetrieval } from "@/lib/retrieve";

describe("runRetrieval", () => {
  it("bypasses embedding + pinecone when skip_RAG is true", async () => {
    const out = await runRetrieval({
      query: "hello",
      gatekeeper: {
        skip_RAG: true,
        reframed_query: null,
        emotions: null,
        people: null,
        keywords: null,
        date_int: null,
      },
      top_k: 12,
    });

    expect(out.chunks).toEqual([]);
    expect(out.stats.base_count).toBe(0);
    expect(out.stats.matched_count).toBe(0);
  });
});

