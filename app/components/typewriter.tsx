"use client";

import { useLayoutEffect, useMemo, useState } from "react";

export type TypewriterSegment = {
  id: string;
  text: string;
  // Optional pause inserted after the segment completes (useful between lines/blocks).
  pauseAfterMs?: number;
};

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches ?? false;
}

function fnv1a32(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function makeRng(seed: number): () => number {
  // xorshift32
  let x = (seed | 0) || 1;
  return () => {
    x ^= x << 13;
    x ^= x >>> 17;
    x ^= x << 5;
    return ((x >>> 0) & 0xffffffff) / 4294967296;
  };
}

function upperBound(sorted: number[], x: number): number {
  // Returns number of items <= x.
  let lo = 0;
  let hi = sorted.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (sorted[mid] <= x) lo = mid + 1;
    else hi = mid;
  }
  return lo;
}

function charDelayMs(opts: {
  ch: string;
  prev: string;
  baseMs: number;
  rng: () => number;
}): number {
  const { ch, prev, baseMs, rng } = opts;

  // Small variance makes the cadence feel less robotic but stays deterministic per runId.
  const jitter = (rng() - 0.5) * 2 * baseMs * 0.35;
  let d = baseMs + jitter;

  if (ch === "\n") d += 280;
  if (ch === " ") d += 12;
  if (/[.,]/.test(ch)) d += 140;
  if (/[;:]/.test(ch)) d += 170;
  if (/[!?]/.test(ch)) d += 240;

  // A slight hesitation at the start of sentences/after line breaks.
  if (prev === "\n") d += 120;
  if (/[.!?]/.test(prev)) d += 90;

  // Clamp so jitter doesn't produce negative / too-fast bursts.
  return Math.max(12, d);
}

export function useTypewriterTextMap(opts: {
  segments: TypewriterSegment[];
  runId: number;
  charsPerSecond?: number;
  delayMs?: number;
}): { textById: Record<string, string>; isDone: boolean } {
  const { segments, runId, charsPerSecond = 22, delayMs = 0 } = opts;
  // Avoid hydration mismatch by only reading matchMedia on the client.
  const [reducedMotion, setReducedMotion] = useState(false);
  useLayoutEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReducedMotion(mql.matches);
    onChange();
    mql.addEventListener?.("change", onChange);
    return () => mql.removeEventListener?.("change", onChange);
  }, []);

  const totalChars = useMemo(() => {
    return segments.reduce((sum, s) => sum + (s.text?.length ?? 0), 0);
  }, [segments]);

  const scheduleMs = useMemo(() => {
    // scheduleMs[i] = time in ms at which (i+1) total characters become visible.
    const baseMs = 1000 / Math.max(1, charsPerSecond);
    const seedStr = `${runId}|${segments.map((s) => `${s.id}:${s.text}`).join("|")}`;
    const rng = makeRng(fnv1a32(seedStr));

    const out: number[] = [];
    let t = 0;
    let prev = "";

    for (const seg of segments) {
      const text = seg.text ?? "";
      for (let i = 0; i < text.length; i++) {
        const ch = text[i] ?? "";
        t += charDelayMs({ ch, prev, baseMs, rng });
        out.push(t);
        prev = ch;
      }
      const pause = typeof seg.pauseAfterMs === "number" ? seg.pauseAfterMs : 90;
      if (pause > 0) t += pause;
    }

    return out;
  }, [charsPerSecond, runId, segments]);

  const [visibleChars, setVisibleChars] = useState(0);

  useLayoutEffect(() => {
    if (reducedMotion) {
      setVisibleChars(totalChars);
      return;
    }

    setVisibleChars(0);
    const startAt = performance.now() + delayMs;
    let raf = 0;
    let last = -1;

    const tick = (now: number) => {
      if (now < startAt) {
        raf = requestAnimationFrame(tick);
        return;
      }

      const elapsedMs = now - startAt;
      const next = Math.min(totalChars, upperBound(scheduleMs, elapsedMs));
      if (next !== last) {
        last = next;
        setVisibleChars(next);
      }

      if (next < totalChars) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [runId, reducedMotion, totalChars, scheduleMs, delayMs]);

  const textById = useMemo(() => {
    const out: Record<string, string> = {};
    let remaining = visibleChars;

    for (const seg of segments) {
      const full = seg.text ?? "";
      if (remaining <= 0) {
        out[seg.id] = "";
        continue;
      }
      const take = Math.min(full.length, remaining);
      out[seg.id] = full.slice(0, take);
      remaining -= take;
    }

    return out;
  }, [segments, visibleChars]);

  return { textById, isDone: visibleChars >= totalChars };
}
