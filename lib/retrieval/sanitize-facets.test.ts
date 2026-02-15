import { describe, expect, it } from "vitest";

import { sanitizeEmotions, sanitizeLowercaseStrings } from "@/lib/retrieval/sanitize-facets";

describe("sanitizeLowercaseStrings", () => {
  it("trims, lowercases, uniques, and caps", () => {
    const out = sanitizeLowercaseStrings(
      ["  Alice  ", "ALICE", "Bob", "", "   ", 123, null, "Bob", "Cara"],
      2,
    );
    expect(out).toEqual(["alice", "bob"]);
  });

  it("returns [] for non-arrays", () => {
    expect(sanitizeLowercaseStrings("nope", 10)).toEqual([]);
  });
});

describe("sanitizeEmotions", () => {
  it("filters to allowed emotions, uniques, and caps", () => {
    const out = sanitizeEmotions(
      ["Joy", "Joy", "NotARealEmotion", "Loneliness", 123, "Neutral", "Anger"],
      3,
    );
    expect(out).toEqual(["Joy", "Loneliness", "Neutral"]);
  });

  it("returns [] for non-arrays", () => {
    expect(sanitizeEmotions({ emotions: ["Joy"] }, 10)).toEqual([]);
  });
});

