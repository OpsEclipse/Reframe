import { describe, expect, it } from "vitest";
import { normalizeSourceCitations } from "@/app/chat/source-citations";

describe("normalizeSourceCitations", () => {
  it("filters invalid entries and dedupes by id preserving order", () => {
    const input = [
      { id: "c1", title: "T1", score: 0.9 },
      { id: "   " },
      null,
      { id: "c1", title: "dup" },
      { id: "c2", source: "S2", score: "nope" },
    ];
    const out = normalizeSourceCitations(input);
    expect(out.map((s) => s.id)).toEqual(["c1", "c2"]);
    expect(out[0]?.title).toBe("T1");
    expect(out[1]?.score).toBeNull();
  });
});

