// Utilities for safely parsing "JSON-only" model outputs.
// Keep this small and dependency-free so it can be reused by API routes and helpers.

export function stripCodeFences(text: string): string {
  // Some models occasionally wrap JSON in ```json fences despite instructions.
  return text.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
}

export function extractLastJsonObject(text: string): string {
  // Extract the last {...} JSON object in `text` while respecting strings/escapes.
  // This is a safety net only; callers should prefer strict JSON-only completions.
  let inString = false;
  let escape = false;
  let depth = 0;
  let end = -1;
  let start = -1;

  for (let i = text.length - 1; i >= 0; i--) {
    const ch = text[i];
    if (inString) {
      if (escape) {
        escape = false;
        continue;
      }
      if (ch === "\\") {
        escape = true;
        continue;
      }
      if (ch === "\"") inString = false;
      continue;
    }

    if (ch === "\"") {
      inString = true;
      escape = false;
      continue;
    }

    if (ch === "}") {
      if (end === -1) end = i;
      depth++;
      continue;
    }
    if (ch === "{") {
      depth--;
      if (depth === 0 && end !== -1) {
        start = i;
        break;
      }
      continue;
    }
  }

  if (start === -1 || end === -1 || end <= start) {
    throw new Error("No JSON object found in model output");
  }
  return text.slice(start, end + 1);
}

export function parseModelJsonObject(rawText: string): unknown {
  const cleaned = stripCodeFences(rawText).trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const lastObj = extractLastJsonObject(cleaned);
    return JSON.parse(lastObj);
  }
}

