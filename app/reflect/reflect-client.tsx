"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { ArchiveReflectionSchema, type ArchiveReflection } from "@/lib/archive-reflection";

import RatingButton, { EnterArrowIcon } from "../components/rating_button";
import ReframeTimelineEntry from "../components/reframe-timeline-entry";
import SourcePreviewModal from "../components/source-preview-modal";
import { useTypewriterTextMap, type TypewriterSegment } from "../components/typewriter";

function detectTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

function shouldInsertSpaceBetween(left: string, right: string): boolean {
  if (!left || !right) return false;
  if (/\s$/.test(left) || /^\s/.test(right)) return false;
  if (/^[.,;:!?)]/.test(right)) return false;
  if (/[([{]$/.test(left)) return false;
  return true;
}

function normalizeAnchorLineSegments(anchor: {
  before: string;
  highlight: string;
  after: string;
}): { before: string; highlight: string; after: string } {
  let before = anchor.before;
  let after = anchor.after;

  if (shouldInsertSpaceBetween(before, anchor.highlight)) before = `${before} `;
  if (shouldInsertSpaceBetween(anchor.highlight, after)) after = ` ${after}`;

  return { before, highlight: anchor.highlight, after };
}

export default function ReflectClient() {
  const [reflection, setReflection] = useState<ArchiveReflection | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [runId, setRunId] = useState(0);
  const abortRef = useRef<AbortController | null>(null);
  const [isSourceModalOpen, setIsSourceModalOpen] = useState(false);
  const [sourceModalIndex, setSourceModalIndex] = useState(0);

  const generate = useCallback(async (payload?: { timezone?: string; name?: string }) => {
    abortRef.current?.abort();
    const abort = new AbortController();
    abortRef.current = abort;

    setIsLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/archive-reflection", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload ?? {}),
        signal: abort.signal,
      });

      if (!res.ok) {
        if (res.status === 429) {
          setError("Rate limited.");
          return;
        }
        setError("Reflection generation failed.");
        return;
      }

      const json = (await res.json()) as unknown;
      const parsed = ArchiveReflectionSchema.safeParse(json);
      if (!parsed.success) {
        setError("Reflection generation failed.");
        return;
      }

      setReflection(parsed.data);
      setRunId((x) => x + 1);
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return;
      setError("Reflection generation failed.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const hasStartedRef = useRef(false);
  useEffect(() => {
    if (hasStartedRef.current) return;
    hasStartedRef.current = true;
    // Auto-start generation on load (no streaming; we animate reveal client-side).
    void generate({ timezone: detectTimezone() });
  }, [generate]);

  const timeline = useMemo(() => reflection?.timeline ?? [], [reflection?.timeline]);
  const sources = useMemo(() => reflection?.sources ?? [], [reflection?.sources]);
  const sourceIndexById = useMemo(() => {
    const m = new Map<string, number>();
    for (let i = 0; i < sources.length; i++) {
      const id = sources[i]?.id;
      if (typeof id === "string" && id) m.set(id, i);
    }
    return m;
  }, [sources]);
  const isRateLimited = error === "Rate limited.";

  // If a new reflection arrives, close the modal to avoid mismatched content.
  useEffect(() => {
    setIsSourceModalOpen(false);
  }, [runId]);

  const openSourceModalById = useCallback(
    (sourceId: string) => {
      const idx = sourceIndexById.get(sourceId);
      if (typeof idx !== "number") return;
      setSourceModalIndex(idx);
      setIsSourceModalOpen(true);
    },
    [sourceIndexById],
  );

  const anchor = useMemo(() => {
    return normalizeAnchorLineSegments({
      before: reflection?.anchor_line?.before ?? "",
      highlight: reflection?.anchor_line?.highlight ?? "",
      after: reflection?.anchor_line?.after ?? "",
    });
  }, [reflection?.anchor_line?.after, reflection?.anchor_line?.before, reflection?.anchor_line?.highlight]);

  const typewriterSegments = useMemo<TypewriterSegment[]>(() => {
    if (!reflection) return [];

    const segs: TypewriterSegment[] = [];
    segs.push({ id: "greeting", text: reflection.greeting ?? "", pauseAfterMs: 260 });
    // Keep the anchor line continuous (no segment pauses) so it reads like one sentence.
    segs.push({ id: "anchor-before", text: anchor.before ?? "", pauseAfterMs: 0 });
    segs.push({ id: "anchor-highlight", text: anchor.highlight ?? "", pauseAfterMs: 0 });
    segs.push({ id: "anchor-after", text: anchor.after ?? "", pauseAfterMs: 260 });

    for (let i = 0; i < (reflection.lines ?? []).length; i++) {
      segs.push({ id: `line-${i}`, text: reflection.lines[i] ?? "", pauseAfterMs: 210 });
    }
    segs.push({ id: "transition", text: reflection.transition ?? "", pauseAfterMs: 260 });

    for (let i = 0; i < (reflection.timeline ?? []).length; i++) {
      const t = reflection.timeline[i];
      // Period and count appear on the same line; keep them tight, then pause after the body.
      segs.push({ id: `tl-${i}-period`, text: t?.periodLabel ?? "", pauseAfterMs: 40 });
      segs.push({ id: `tl-${i}-count`, text: t?.entriesCountLabel ?? "", pauseAfterMs: 120 });
      segs.push({ id: `tl-${i}-content`, text: t?.content ?? "", pauseAfterMs: 260 });
    }

    segs.push({ id: "conclusion", text: reflection.conclusion ?? "", pauseAfterMs: 260 });
    for (let i = 0; i < (reflection.pattern ?? []).length; i++) {
      segs.push({ id: `pattern-${i}`, text: reflection.pattern[i] ?? "", pauseAfterMs: 160 });
    }
    segs.push({ id: "question", text: reflection.question ?? "", pauseAfterMs: 0 });

    return segs;
  }, [anchor.after, anchor.before, anchor.highlight, reflection]);

  const { textById } = useTypewriterTextMap({
    segments: typewriterSegments,
    runId,
    // Faster base speed, but with punctuation + segment pauses for a more human cadence.
    charsPerSecond: 28,
    delayMs: 120,
  });

  return (
    <section className="flex min-h-0 flex-1 flex-col items-start gap-8">
      {isSourceModalOpen ? (
        <SourcePreviewModal
          sources={sources}
          initialIndex={sourceModalIndex}
          onClose={() => setIsSourceModalOpen(false)}
        />
      ) : null}
      <div className="flex w-full items-start justify-between gap-6">
        <div className="min-w-0 flex-1">
          <p className="text-[20px] font-semibold leading-none text-white/90 whitespace-pre-wrap">
            {reflection ? textById["greeting"] ?? "" : isLoading ? "…" : ""}
          </p>

          <p className="mt-4 w-full max-w-[491px] text-[16px] font-medium leading-[1.5] text-white/90 whitespace-pre-wrap">
            <span>{reflection ? textById["anchor-before"] ?? "" : anchor.before}</span>
            <span className="text-white/60">{reflection ? textById["anchor-highlight"] ?? "" : anchor.highlight}</span>
            <span>{reflection ? textById["anchor-after"] ?? "" : anchor.after}</span>
          </p>
        </div>
        <RatingButton
          variant="enter"
          dataNodeId="36:4158"
          aria-label="Enter"
          disabled={isLoading}
          onClick={() => {
            if (isLoading) return;
            void generate({ timezone: detectTimezone() });
          }}
        >
          <span data-node-id="36:4159">ENTER</span>
          <span className="shrink-0" data-node-id="36:4160">
            <EnterArrowIcon />
          </span>
        </RatingButton>
      </div>

      <div className="flex w-full flex-col items-start gap-6">
        {(reflection?.lines ?? []).map((_, idx) => (
          <p
            key={`line-${idx}`}
            className="w-full max-w-[491px] text-[16px] font-medium leading-[1.5] text-white/90 whitespace-pre-wrap"
          >
            {reflection ? textById[`line-${idx}`] ?? "" : ""}
          </p>
        ))}

        {reflection?.transition ? (
          <p className="w-full max-w-[491px] text-[16px] font-medium leading-[1.5] text-white/75 whitespace-pre-wrap">
            {reflection ? textById["transition"] ?? "" : ""}
          </p>
        ) : null}
      </div>

      <div className="flex w-full flex-col items-start gap-8">
        {timeline.map((item, idx) => {
          const isLast = idx === timeline.length - 1;
          const sourceIdx =
            item?.source_id && typeof item.source_id === "string" ? sourceIndexById.get(item.source_id) : undefined;
          const hasSource = typeof sourceIdx === "number";
          return (
            <ReframeTimelineEntry
              key={`tl-${idx}`}
              periodLabel={reflection ? textById[`tl-${idx}-period`] ?? "" : item?.periodLabel ?? ""}
              entriesCountLabel={reflection ? textById[`tl-${idx}-count`] ?? "" : item?.entriesCountLabel ?? ""}
              periodLabelClassName={isLast ? "text-[#fcc84e]" : undefined}
              onEntriesClick={item?.source_id ? () => openSourceModalById(item.source_id!) : undefined}
              entriesButtonDisabled={!hasSource}
              entriesButtonAriaLabel="Open source preview"
            >
              {reflection ? textById[`tl-${idx}-content`] ?? "" : item?.content ?? ""}
            </ReframeTimelineEntry>
          );
        })}
      </div>

      <div className="flex w-full flex-col items-start gap-6">
        {reflection?.conclusion ? (
          <p className="w-full max-w-[491px] text-[16px] font-semibold leading-[1.5] text-white/90 whitespace-pre-wrap">
            {reflection ? textById["conclusion"] ?? "" : ""}
          </p>
        ) : null}

        {(reflection?.pattern ?? []).map((_, idx) => (
          <p
            key={`pattern-${idx}`}
            className="w-full max-w-[491px] text-[16px] font-medium leading-[1.5] text-white/70 whitespace-pre-wrap"
          >
            {reflection ? textById[`pattern-${idx}`] ?? "" : ""}
          </p>
        ))}

        {reflection?.question ? (
          <p className="w-full max-w-[491px] text-[16px] font-medium leading-[1.5] text-white/80 whitespace-pre-wrap">
            {reflection ? textById["question"] ?? "" : ""}
          </p>
        ) : null}

        {error ? (
          <p className="w-full max-w-[491px] text-sm text-red-200/80">
            {isRateLimited ? "Rate limited. Wait a few seconds, then press ENTER to retry." : error}
          </p>
        ) : null}
      </div>
    </section>
  );
}
