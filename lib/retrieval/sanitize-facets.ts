import { ALLOWED_EMOTIONS, type AllowedEmotion } from "@/lib/gatekeeper";

export const FACET_LIMITS = {
  emotions: 5,
  people: 20,
  keywords: 20,
} as const;

export function toNullable<T>(values: T[]): T[] | null {
  return values.length ? values : null;
}

export function sanitizeLowercaseStrings(values: unknown, maxLen: number): string[] {
  if (!Array.isArray(values)) return [];
  const limit = Number.isFinite(maxLen) ? Math.max(0, Math.trunc(maxLen)) : 0;

  const seen = new Set<string>();
  const out: string[] = [];

  for (const v of values) {
    if (out.length >= limit) break;
    if (typeof v !== "string") continue;
    const s = v.trim().toLowerCase();
    if (!s) continue;
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
  }

  return out;
}

export function sanitizeEmotions(values: unknown, maxLen: number): AllowedEmotion[] {
  if (!Array.isArray(values)) return [];
  const limit = Number.isFinite(maxLen) ? Math.max(0, Math.trunc(maxLen)) : 0;

  const allowed = new Set<string>(ALLOWED_EMOTIONS as readonly string[]);
  const seen = new Set<string>();
  const out: AllowedEmotion[] = [];

  for (const v of values) {
    if (out.length >= limit) break;
    if (typeof v !== "string") continue;
    if (!allowed.has(v)) continue;
    if (seen.has(v)) continue;
    seen.add(v);
    out.push(v as AllowedEmotion);
  }

  return out;
}

