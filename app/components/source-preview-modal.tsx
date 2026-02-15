"use client";

import { Pangolin } from "next/font/google";
import type { PointerEvent as ReactPointerEvent } from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const pangolin = Pangolin({
  subsets: ["latin"],
  weight: "400",
});

type SourcePreview = {
  id: string;
  title?: string | null;
  source?: string | null;
  preview?: string | null;
};

export type SourcePreviewModalProps = {
  sources: SourcePreview[];
  initialIndex?: number;
  onClose: () => void;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

function ChevronIcon({ direction }: { direction: "left" | "right" }) {
  return (
    <svg
      width="12"
      height="12"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
      className={direction === "right" ? "rotate-180" : undefined}
    >
      <path
        d="M14.71 6.71a1 1 0 0 1 0 1.41L10.83 12l3.88 3.88a1 1 0 1 1-1.42 1.41l-4.59-4.58a1 1 0 0 1 0-1.41l4.59-4.59a1 1 0 0 1 1.42 0Z"
        fill="currentColor"
      />
    </svg>
  );
}

export default function SourcePreviewModal({ sources, initialIndex = 0, onClose }: SourcePreviewModalProps) {
  const isBrowser = typeof document !== "undefined";
  const safeSources = Array.isArray(sources) ? sources : [];
  const count = safeSources.length;
  const initial = clamp(Math.trunc(initialIndex), 0, Math.max(0, count - 1));

  const [index, setIndex] = useState(initial);

  // Drag offset relative to a centered base transform.
  const [offset, setOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const offsetRef = useRef(offset);
  useEffect(() => {
    offsetRef.current = offset;
  }, [offset]);

  const cardRef = useRef<HTMLDivElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startOffsetX: number;
    startOffsetY: number;
    bounds: { minX: number; maxX: number; minY: number; maxY: number };
  } | null>(null);

  const canNavigate = count > 1;
  const active = safeSources[index] ?? null;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (!canNavigate) return;
      if (e.key === "ArrowLeft") setIndex((i) => (i - 1 + count) % count);
      if (e.key === "ArrowRight") setIndex((i) => (i + 1) % count);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canNavigate, count, onClose]);

  useEffect(() => {
    return () => {
      if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const setOffsetRaf = useCallback((next: { x: number; y: number }) => {
    if (rafRef.current != null) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => setOffset(next));
  }, []);

  const onPointerDownHeader = useCallback((e: ReactPointerEvent) => {
    if (e.button !== 0) return; // left mouse only
    const margin = 16;
    const el = cardRef.current;
    const rect = el ? el.getBoundingClientRect() : null;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    // Base is centered: left = vw/2 - rect.width/2; top = vh/2 - rect.height/2.
    const baseLeft = rect ? vw / 2 - rect.width / 2 : 0;
    const baseTop = rect ? vh / 2 - rect.height / 2 : 0;
    const w = rect ? rect.width : 0;
    const h = rect ? rect.height : 0;

    const minX = margin - baseLeft;
    const maxX = (vw - w - margin) - baseLeft;
    const minY = margin - baseTop;
    const maxY = (vh - h - margin) - baseTop;

    dragRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffsetX: offsetRef.current.x,
      startOffsetY: offsetRef.current.y,
      bounds: { minX, maxX, minY, maxY },
    };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    e.preventDefault();
  }, []);

  const onPointerMoveHeader = useCallback((e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    const dx = e.clientX - drag.startX;
    const dy = e.clientY - drag.startY;
    const next = {
      x: clamp(Math.round(drag.startOffsetX + dx), Math.round(drag.bounds.minX), Math.round(drag.bounds.maxX)),
      y: clamp(Math.round(drag.startOffsetY + dy), Math.round(drag.bounds.minY), Math.round(drag.bounds.maxY)),
    };
    setOffsetRaf(next);
  }, [setOffsetRaf]);

  const onPointerUpHeader = useCallback((e: ReactPointerEvent) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== e.pointerId) return;
    dragRef.current = null;
    try {
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    } catch {
      // ignore
    }
  }, []);

  const headerRightText = (() => {
    const t = typeof active?.title === "string" && active.title.trim() ? active.title.trim() : null;
    const s = typeof active?.source === "string" && active.source.trim() ? active.source.trim() : null;
    return (t ?? s ?? (active ? "SOURCE" : "")).toUpperCase();
  })();

  const bodyText = (() => {
    const p = typeof active?.preview === "string" && active.preview.trim() ? active.preview.trim() : null;
    return p ?? "";
  })();

  if (!isBrowser) return null;

  return createPortal(
    <div className="fixed inset-0 z-[999]">
      {/* Backdrop only for click-to-dismiss; keep it visually invisible to match Figma. */}
      <button
        type="button"
        aria-label="Close sources modal"
        className="absolute inset-0 cursor-default"
        onClick={onClose}
      />

      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        className={[
          // Figma node 42:70
          "fixed left-1/2 top-1/2",
          "w-[min(560px,calc(100vw-32px))]",
          "rounded-[8px]",
          "border border-white/10",
          "bg-[#1e1e1e]",
          "p-[24px]",
          "shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9)]",
          "select-text",
        ].join(" ")}
        style={{
          transform: `translate(-50%, -50%) translate3d(${Math.round(offset.x)}px, ${Math.round(offset.y)}px, 0)`,
        }}
        data-node-id="42:70"
      >
        <div
          className="flex w-full items-start justify-between gap-6"
          data-node-id="42:93"
          onPointerDown={onPointerDownHeader}
          onPointerMove={onPointerMoveHeader}
          onPointerUp={onPointerUpHeader}
          onPointerCancel={onPointerUpHeader}
          style={{ touchAction: "none", cursor: "grab" }}
        >
          <div className="flex items-center justify-center gap-[4px]" data-node-id="42:90">
            {canNavigate ? (
              <>
                <button
                  type="button"
                  aria-label="Previous source"
                  className="text-white/40 transition hover:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-[4px]"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setIndex((i) => (i - 1 + count) % count)}
                >
                  <ChevronIcon direction="left" />
                </button>
                <p className="font-mono text-[12px] font-medium leading-[normal] text-white/40" data-node-id="42:89">
                  {index + 1}/{count}
                </p>
                <button
                  type="button"
                  aria-label="Next source"
                  className="text-white/40 transition hover:text-white/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 rounded-[4px]"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setIndex((i) => (i + 1) % count)}
                >
                  <ChevronIcon direction="right" />
                </button>
              </>
            ) : (
              <p className="font-mono text-[12px] font-medium leading-[normal] text-white/40">{count ? "1/1" : "0/0"}</p>
            )}
          </div>

          <p className="font-mono text-[12px] font-medium leading-[normal] text-white/40" data-node-id="42:77">
            {headerRightText}
          </p>
        </div>

        <p
          className={[
            pangolin.className,
            "mt-[19px]",
            "text-[16px] leading-[1.5] not-italic",
            "text-white/60",
            "whitespace-pre-wrap",
            "w-full",
          ].join(" ")}
          data-node-id="42:85"
        >
          {bodyText || "No preview available."}
        </p>
      </div>
    </div>,
    document.body,
  );
}
