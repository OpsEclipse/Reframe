import { describe, expect, it } from "vitest";
import { parseChatGenerateModelOutput } from "@/lib/rag-answer";

describe("parseChatGenerateModelOutput", () => {
  it("parses strict JSON-only output", () => {
    const raw = JSON.stringify({
      answer: "hi",
      sources: [{ id: "c1", title: "T", source: "S", score: 0.9, preview: "p" }],
    });
    const parsed = parseChatGenerateModelOutput(raw);
    expect(parsed.answer).toBe("hi");
    expect(parsed.sources).toHaveLength(1);
    expect(parsed.sources[0]?.id).toBe("c1");
    expect(parsed.sources[0]?.score).toBe(0.9);
  });

  it("falls back to extract last JSON object if extra text exists", () => {
    const raw =
      "Ignore this.\n" +
      JSON.stringify({ answer: "no", sources: [] }) +
      "\nAnd this too.\n" +
      JSON.stringify({ answer: "yes", sources: [{ id: "c2", score: null }] });
    const parsed = parseChatGenerateModelOutput(raw);
    expect(parsed.answer).toBe("yes");
    expect(parsed.sources[0]?.id).toBe("c2");
  });

  it("throws if no JSON object exists", () => {
    expect(() => parseChatGenerateModelOutput("hello")).toThrow(/No JSON object/);
  });
});

