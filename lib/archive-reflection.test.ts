import { describe, expect, it } from "vitest";
import { ArchiveReflectionSchema, sanitizeArchiveReflection } from "@/lib/archive-reflection";

describe("ArchiveReflectionSchema", () => {
  it("accepts a valid object shape", () => {
    const obj = {
      greeting: "Raghav,",
      anchor_line: { before: "A year ago, you believed you were ", highlight: "stationary", after: "." },
      lines: ["You used the word “stuck.”", "You kept waiting for clarity."],
      transition: "But if we look, your entries show change:",
      timeline: [
        {
          periodLabel: "IN APRIL 2025",
          entriesCountLabel: "3+",
          content: "You took on a project anyway.",
          source_id: "c1",
          reframe: null,
        },
      ],
      conclusion: "You were not stuck.\nYou were early.",
      pattern: ["You move when you stop asking permission."],
      question: "Why do you only recognize progress in hindsight?",
      sources: [{ id: "c1", title: "T", source: "S", score: 0.9, preview: "P" }],
    };

    const parsed = ArchiveReflectionSchema.parse(obj);
    expect(parsed.greeting).toBe("Raghav,");
    expect(parsed.timeline).toHaveLength(1);
    expect(parsed.sources[0]?.id).toBe("c1");
  });
});

describe("sanitizeArchiveReflection", () => {
  it("trims strings and clamps array sizes", () => {
    // Intentionally violate schema max sizes; sanitizeArchiveReflection is responsible for clamping.
    const raw = {
      greeting: " Raghav, ",
      anchor_line: { before: " A year ago ", highlight: " stationary ", after: " " },
      lines: Array.from({ length: 12 }, (_, i) => ` line ${i} `),
      transition: "  But if we look  ",
      timeline: Array.from({ length: 20 }, (_, i) => ({
        periodLabel: ` IN M${i} `,
        entriesCountLabel: " 3+ ",
        content: " x ",
        source_id: i % 2 === 0 ? "ok" : null,
        reframe: " q ",
      })),
      conclusion: "  End  ",
      pattern: Array.from({ length: 20 }, (_, i) => ` p${i} `),
      question: "  Q? ",
      sources: Array.from({ length: 20 }, () => ({ id: "ok", score: 1 })),
    } as unknown as ReturnType<typeof ArchiveReflectionSchema.parse>;

    const out = sanitizeArchiveReflection(raw, { validSourceIds: ["ok"] });
    expect(out.greeting).toBe("Raghav,");
    expect(out.anchor_line.after).toBe(".");
    expect(out.lines.length).toBeLessThanOrEqual(6);
    expect(out.timeline.length).toBeLessThanOrEqual(8);
    expect(out.pattern.length).toBeLessThanOrEqual(4);
    expect(out.sources.length).toBeLessThanOrEqual(8);
  });

  it("nulls invalid source ids", () => {
    const raw = ArchiveReflectionSchema.parse({
      greeting: "Raghav,",
      anchor_line: { before: "A ", highlight: "B", after: "." },
      lines: ["x"],
      transition: "t",
      timeline: [
        {
          periodLabel: "IN APRIL 2025",
          entriesCountLabel: "3+",
          content: "c",
          source_id: "not-allowed",
          reframe: "should drop",
        },
      ],
      conclusion: "end",
      pattern: [],
      question: "q",
      sources: [{ id: "not-allowed", score: null }],
    });

    const out = sanitizeArchiveReflection(raw, { validSourceIds: ["allowed"] });
    expect(out.timeline[0]?.source_id).toBeNull();
    expect(out.timeline[0]?.reframe).toBeNull();
    expect(out.sources).toEqual([]);
  });
});
