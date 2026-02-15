import { describe, expect, it } from "vitest";

import { parseGatekeeperMetadata } from "@/lib/gatekeeper";

describe("parseGatekeeperMetadata", () => {
  it("defaults skip_RAG to false when missing", () => {
    const meta = parseGatekeeperMetadata({
      reframed_query: null,
      emotions: null,
      people: null,
      keywords: null,
      date_int: null,
    });
    expect(meta.skip_RAG).toBe(false);
  });

  it("parses skip_RAG=true", () => {
    const meta = parseGatekeeperMetadata({
      skip_RAG: true,
      reframed_query: null,
      emotions: null,
      people: null,
      keywords: null,
      date_int: null,
    });
    expect(meta.skip_RAG).toBe(true);
  });

  it("accepts string boolean values for skip_RAG", () => {
    const meta = parseGatekeeperMetadata({
      skip_RAG: "true",
      reframed_query: null,
      emotions: null,
      people: null,
      keywords: null,
      date_int: null,
    });
    expect(meta.skip_RAG).toBe(true);
  });
});

