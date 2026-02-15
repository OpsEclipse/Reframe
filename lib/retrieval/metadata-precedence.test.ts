import { describe, expect, it } from "vitest";

import type { AllowedEmotion } from "@/lib/gatekeeper";
import { rankByMetadataPrecedence } from "@/lib/retrieval/metadata-precedence";

describe("rankByMetadataPrecedence", () => {
  it("ranks dual-emotion match above partial matches", () => {
    const query = {
      emotions: ["Joy", "Loneliness"] as AllowedEmotion[],
      people: null,
      keywords: null,
      date_int: null,
    };

    const matches = [
      { id: "joy", score: 0.99, metadata: { emotions: ["Joy"] } },
      { id: "lonely", score: 0.98, metadata: { emotions: ["Loneliness"] } },
      { id: "both", score: 0.2, metadata: { emotions: ["Joy", "Loneliness"] } },
    ];

    const ranked = rankByMetadataPrecedence(query, matches);
    expect(ranked[0]?.id).toBe("both");
  });

  it("uses coverage + facet match count before semantic score", () => {
    const query = {
      emotions: ["Joy", "Loneliness"] as AllowedEmotion[],
      people: null,
      keywords: ["breakup", "therapy", "family"],
      date_int: null,
    };

    const matches = [
      {
        id: "A",
        score: 0.9,
        metadata: { emotions: ["Joy", "Loneliness"], keywords: ["breakup"] },
      },
      {
        id: "B",
        score: 0.99,
        metadata: { emotions: ["Joy"], keywords: ["breakup", "therapy"] },
      },
    ];

    const ranked = rankByMetadataPrecedence(query, matches);
    expect(ranked[0]?.id).toBe("A");
  });

  it("preserves semantic ordering when query facets are empty", () => {
    const query = {
      emotions: null,
      people: null,
      keywords: null,
      date_int: null,
    };

    const matches = [
      { id: "low", score: 0.1, metadata: { emotions: ["Joy"] } },
      { id: "high", score: 0.9, metadata: { emotions: ["Loneliness"] } },
    ];

    const ranked = rankByMetadataPrecedence(query, matches);
    expect(ranked[0]?.id).toBe("high");
    expect(ranked[1]?.id).toBe("low");
  });
});
