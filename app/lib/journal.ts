export type JournalEntry = {
  dateInt: number;
  extractedDateInt?: string;
  title: string;
  content: string;
  contextSummary?: string;
  emotions: string[];
  keywords: string[];
  people: string[];
};

type RawJournalEntry = {
  date_int?: unknown;
  extracted_date_int?: unknown;
  title?: unknown;
  content?: unknown;
  context_summary?: unknown;
  ["emotion(s)"]?: unknown;
  keywords?: unknown;
  people?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function toStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map(String).filter(Boolean);
}

function normalizeRawEntry(raw: RawJournalEntry): JournalEntry | null {
  const dateInt =
    typeof raw.date_int === "number"
      ? raw.date_int
      : typeof raw.date_int === "string"
        ? Number(raw.date_int)
        : NaN;
  if (!Number.isFinite(dateInt)) return null;

  const title = typeof raw.title === "string" ? raw.title : "";
  const content = typeof raw.content === "string" ? raw.content : "";
  if (!title || !content) return null;

  return {
    dateInt,
    extractedDateInt:
      typeof raw.extracted_date_int === "string" ? raw.extracted_date_int : undefined,
    title,
    content,
    contextSummary:
      typeof raw.context_summary === "string" ? raw.context_summary : undefined,
    emotions: toStringArray(raw["emotion(s)"]),
    keywords: toStringArray(raw.keywords),
    people: toStringArray(raw.people),
  };
}

function looksLikeJournalArray(value: unknown): value is RawJournalEntry[] {
  if (!Array.isArray(value) || value.length === 0) return false;
  const first = value[0];
  if (!isRecord(first)) return false;
  return (
    "date_int" in first &&
    "title" in first &&
    "content" in first
  );
}

function tryParseJsonFromString(text: string): unknown | null {
  try {
    return JSON.parse(text);
  } catch {
    // Some APIs return "return text" that wraps JSON; try extracting the array/object.
    const trimmed = text.trim();
    const firstArray = trimmed.indexOf("[");
    const lastArray = trimmed.lastIndexOf("]");
    if (firstArray !== -1 && lastArray !== -1 && lastArray > firstArray) {
      try {
        return JSON.parse(trimmed.slice(firstArray, lastArray + 1));
      } catch {
        // fall through
      }
    }
    const firstObj = trimmed.indexOf("{");
    const lastObj = trimmed.lastIndexOf("}");
    if (firstObj !== -1 && lastObj !== -1 && lastObj > firstObj) {
      try {
        return JSON.parse(trimmed.slice(firstObj, lastObj + 1));
      } catch {
        // fall through
      }
    }
    return null;
  }
}

export function parseJournalEntriesFromUnknown(input: unknown): JournalEntry[] | null {
  let value: unknown = input;

  if (typeof value === "string") {
    const parsed = tryParseJsonFromString(value);
    if (parsed === null) return null;
    value = parsed;
  }

  if (looksLikeJournalArray(value)) {
    const normalized = value
      .map((v) => (isRecord(v) ? normalizeRawEntry(v as RawJournalEntry) : null))
      .filter((v): v is JournalEntry => v !== null);
    return normalized.length ? normalized : null;
  }

  // Handle a common wrapping shape: { entries: [...] } or { data: [...] }
  if (isRecord(value)) {
    const candidates = [value.entries, value.data, value.result, value.results];
    for (const c of candidates) {
      if (looksLikeJournalArray(c)) {
        const normalized = c
          .map((v) => (isRecord(v) ? normalizeRawEntry(v as RawJournalEntry) : null))
          .filter((v): v is JournalEntry => v !== null);
        return normalized.length ? normalized : null;
      }
    }
  }

  return null;
}

export function dateIntToIso(dateInt: number): string | null {
  // Ex: 20070710 -> "2007-07-10"
  const s = String(Math.trunc(dateInt));
  if (!/^\d{8}$/.test(s)) return null;
  const y = s.slice(0, 4);
  const m = s.slice(4, 6);
  const d = s.slice(6, 8);
  return `${y}-${m}-${d}`;
}

