"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import RatingButton, { EnterArrowIcon } from "./rating_button";
import HomeActionMenu from "./home-action-menu";
import MeasuredWidthDiv from "./measured-width-div";

function prefersReducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

type IntroGreetingBlockProps = {
  greeting: string;
};

export default function IntroGreetingBlock({ greeting }: IntroGreetingBlockProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isContentVisible, setIsContentVisible] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [heightPx, setHeightPx] = useState<number | null>(null);
  const [isRatingContentMounted, setIsRatingContentMounted] = useState(true);
  const [isRatingContentExiting, setIsRatingContentExiting] = useState(false);
  const [isMenuMounted, setIsMenuMounted] = useState(false);
  const [isMenuVisible, setIsMenuVisible] = useState(false);

  const ratingChoices = useMemo(() => [1, 2, 3, 4, 5] as const, []);
  const canSubmit = isExpanded && isContentVisible && rating !== null;
  const reducedMotion = useMemo(() => prefersReducedMotion(), []);

  const beginMenuEnter = useCallback(() => {
    setIsMenuMounted(true);

    if (reducedMotion) {
      setIsMenuVisible(true);
      return;
    }

    // Ensure the initial hidden styles paint before we flip to visible.
    requestAnimationFrame(() => setIsMenuVisible(true));
  }, [reducedMotion]);

  const submit = useCallback(() => {
    if (!canSubmit) return;

    if (reducedMotion) {
      setIsRatingContentMounted(false);
      setIsRatingContentExiting(false);
      beginMenuEnter();
      return;
    }

    setIsRatingContentExiting(true);
  }, [beginMenuEnter, canSubmit, reducedMotion]);

  // Lock the collapsed height to the initial greeting height so the later height transition
  // animates predictably (instead of relying on max-height heuristics).
  useLayoutEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const measured = Math.ceil(el.getBoundingClientRect().height);
    if (!Number.isFinite(measured) || measured <= 0) return;
    setHeightPx(measured);
  }, [reducedMotion]);

  useEffect(() => {
    if (!containerRef.current) return;

    if (reducedMotion) {
      // Avoid synchronous setState inside an effect body (can cause cascading renders).
      const timeout = window.setTimeout(() => {
        setIsExpanded(true);
        setIsContentVisible(true);
      }, 0);
      return () => window.clearTimeout(timeout);
    }

    const el = containerRef.current;
    const onAnimationEnd = (event: AnimationEvent) => {
      // Only expand once the width slide has finished.
      if (event.animationName !== "ch26-greeting-expand") return;
      setIsExpanded(true);
    };

    el.addEventListener("animationend", onAnimationEnd);
    return () => {
      el.removeEventListener("animationend", onAnimationEnd);
    };
  }, [reducedMotion]);

  useEffect(() => {
    if (!isExpanded) return;
    if (reducedMotion) return;
    if (isContentVisible) return;

    // Fallback in case the height transitionend is skipped (tab switch, perf hiccup, etc).
    const timeout = window.setTimeout(() => {
      setIsContentVisible(true);
    }, 2400);

    return () => window.clearTimeout(timeout);
  }, [isContentVisible, isExpanded, reducedMotion]);

  // Once expanded, keep the locked height in sync with any content changes
  // (e.g. selecting a rating reveals more UI).
  useLayoutEffect(() => {
    if (!isExpanded) return;
    const el = containerRef.current;
    if (!el) return;

    const raf = window.requestAnimationFrame(() => {
      const expanded = Math.ceil(el.scrollHeight);
      if (!Number.isFinite(expanded) || expanded <= 0) return;
      setHeightPx((prev) => (prev === expanded ? prev : expanded));
    });

    return () => window.cancelAnimationFrame(raf);
  }, [isExpanded, isMenuMounted, isMenuVisible, isRatingContentExiting, isRatingContentMounted, rating]);

  useEffect(() => {
    if (!canSubmit) return;
    if (!isRatingContentMounted) return;
    if (isRatingContentExiting) return;
    if (isMenuMounted) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (event.defaultPrevented) return;
      if (event.isComposing) return;
      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;

      event.preventDefault();
      submit();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [canSubmit, isMenuMounted, isRatingContentExiting, isRatingContentMounted, submit]);

  return (
    <MeasuredWidthDiv
      cssVarName="--ch26-greeting-width-start"
      ref={containerRef}
      onTransitionEnd={(event) => {
        if (!isExpanded) return;
        if (event.propertyName !== "height") return;
        setIsContentVisible(true);
      }}
      data-node-id="29:9"
      style={{
        // Keep height locked to the measured px value. Removing it would snap to `auto` (not animatable),
        // which causes a visible jump in vertical centering.
        height: heightPx ? `${heightPx}px` : undefined,
      }}
      className={[
        "relative z-10 mx-auto flex h-fit items-start text-left",
        isMenuMounted ? "flex-row gap-[clamp(28px,4vw,64px)]" : "flex-col",
        // Prevent the greeting's flicker translateY from clipping against the container while height is locked.
        "py-[6px]",
        "min-h-[56px]",
        // Start at content width (measured client-side into --ch26-greeting-width-start).
        "w-fit",
        "w-[var(--ch26-greeting-width-start,max-content)]",
        // Height reveal: keep the container clipped until the height transition completes.
        // After that, allow child reveal transforms to render without being clipped.
        isContentVisible ? "overflow-visible" : "overflow-hidden",
        // Animate real height (measured) so easing is meaningful and we don't overshoot into empty space.
        "transition-[height]",
        "duration-[2200ms]",
        // Ease-out tends to read cleaner for an expanding container.
        "ease-[cubic-bezier(0.22,1,0.36,1)]",
        // Width slide (runs once the app enters the final stage).
        "will-change-[width,height]",
        "group-data-[ch26-stage=final]:animate-[ch26-greeting-expand_1600ms_cubic-bezier(0.16,1,0.3,1)_both]",
        "group-data-[ch26-stage=final]:[animation-delay:var(--ch26-greeting-end)]",
        "motion-reduce:will-change-auto",
        "motion-reduce:animate-none",
        "motion-reduce:w-[70%]",
        "motion-reduce:transition-none",
      ].join(" ")}
    >
      <div
        className={[
          isMenuMounted ? "min-w-0 flex-1" : "w-full",
          "flex flex-col items-start gap-[32px]",
        ].join(" ")}
      >
        <p
          className={[
            "m-0 text-2xl font-semibold leading-none",
            "opacity-0",
            // Keep opacity transition behavior as before; color is handled separately above.
            "transition-[opacity]",
            "will-change-[opacity]",
            "group-data-[ch26-stage=final]:animate-[ch26-greeting-flicker_2800ms_cubic-bezier(0.16,1,0.3,1)_both]",
            // Start the flicker only after the intro overlay has fully faded.
            "group-data-[ch26-stage=final]:[animation-delay:var(--ch26-greeting-start)]",
            // Safety: if the animation is dropped for any reason, still reveal the greeting after the same delay.
            "group-data-[ch26-stage=final]:opacity-100",
            "group-data-[ch26-stage=final]:[transition-delay:var(--ch26-greeting-start)]",
            "group-data-[ch26-stage=final]:[transition-duration:120ms]",
            "motion-reduce:will-change-auto",
            "motion-reduce:animate-none",
            "motion-reduce:opacity-100",
            "transition-[opacity,transform]",
            "duration-[2200ms]",
            "ease-[cubic-bezier(0.16,1,0.3,1)]",
            // Exit is opacity-only (no translate) so the greeting fades out with the rating step.
            // Use `!` because the greeting is also forced visible via `group-data-[ch26-stage=final]:opacity-100`,
            // which otherwise wins via higher selector specificity.
            isRatingContentExiting ? "!opacity-0" : "!opacity-100",
            "motion-reduce:duration-0 motion-reduce:opacity-100",
          ].join(" ")}
          data-node-id="29:8"
        >
          <span
            className={[
              "inline-block origin-top-left",
              // While expanding vertically, soften + shrink the greeting so the prompt can take priority.
              isExpanded ? "text-white/60" : "text-white/90",
              "transition-[color]",
              "duration-[900ms]",
              "ease-[cubic-bezier(0.16,1,0.3,1)]",
              "motion-reduce:transition-none",
            ].join(" ")}
          >
            {greeting}
          </span>
        </p>

        {isExpanded ? (
          <div
            className={[
              "w-full",
              "flex flex-col items-start gap-[32px]",
              "transition-[opacity,transform]",
              "duration-[2200ms]",
              "ease-[cubic-bezier(0.16,1,0.3,1)]",
              isRatingContentExiting
                ? "opacity-0 pointer-events-none select-none"
                : isContentVisible
                  ? "opacity-100 pointer-events-auto select-auto translate-y-0"
                  : "opacity-100 pointer-events-none select-none translate-y-0",
              "motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100",
            ].join(" ")}
            aria-hidden={!isContentVisible}
            data-node-id="36:3674"
          >
            {isRatingContentMounted ? (
              <div
                className={[
                  "flex flex-col items-start gap-[32px]",
                  "w-full",
                  "transition-[opacity,transform]",
                  "duration-[2200ms]",
                  "ease-[cubic-bezier(0.16,1,0.3,1)]",
                  isRatingContentExiting
                    ? "opacity-0 pointer-events-none select-none"
                    : "opacity-100 translate-y-0",
                  "motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100",
                ].join(" ")}
                onTransitionEnd={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.propertyName !== "opacity") return;
                  if (!isRatingContentExiting) return;

                  setIsRatingContentMounted(false);
                  setIsRatingContentExiting(false);
                  beginMenuEnter();
                }}
              >
                <p
                  className={[
                    "m-0 text-[28px] font-medium leading-[1.15] text-white/90",
                    "transition-[opacity,transform]",
                    "duration-1300",
                    "ease-[cubic-bezier(0.16,1,0.3,1)]",
                    isContentVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-[24px]",
                    "motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100",
                  ].join(" ")}
                >
                  On a scale of 1-5, how grateful are you feeling today?
                </p>

                <div
                  className={[
                    "flex w-full items-center gap-[8px]",
                    "transition-[opacity,transform]",
                    "duration-1300",
                    "ease-[cubic-bezier(0.16,1,0.3,1)]",
                    "delay-[220ms]",
                    isContentVisible
                      ? "opacity-100 translate-y-0"
                      : "opacity-0 translate-y-[28px]",
                    "motion-reduce:delay-0 motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100",
                  ].join(" ")}
                >
                  {ratingChoices.map((value) => (
                    <div
                      key={value}
                      className={[
                        "transition-[opacity,transform]",
                        "duration-1300",
                        "ease-[cubic-bezier(0.16,1,0.3,1)]",
                        isContentVisible
                          ? "opacity-100 translate-y-0"
                          : "opacity-0 translate-y-[18px]",
                        "motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100",
                      ].join(" ")}
                      style={{
                        // Stagger the reveal only; keep the button's color transitions delay-free.
                        transitionDelay: isContentVisible
                          ? `${340 + (value - 1) * 110}ms`
                          : undefined,
                      }}
                    >
                      <RatingButton
                        active={rating === value}
                        // Update on press so the active style responds immediately.
                        onPointerDown={() => setRating(value)}
                        // Keep click for keyboard activation (Enter/Space).
                        onClick={() => setRating(value)}
                      >
                        {value}
                      </RatingButton>
                    </div>
                  ))}
                </div>

                {rating !== null ? (
                  <div
                    className={[
                      "transition-[opacity,transform]",
                      "duration-1300",
                      "ease-[cubic-bezier(0.16,1,0.3,1)]",
                      "delay-[260ms]",
                      isContentVisible
                        ? "opacity-100 translate-y-0"
                        : "opacity-0 translate-y-[18px]",
                      "motion-reduce:delay-0 motion-reduce:transition-none motion-reduce:transform-none motion-reduce:opacity-100",
                    ].join(" ")}
                    aria-hidden={!isContentVisible}
                  >
                    <RatingButton
                      variant="enter"
                      dataNodeId="36:4158"
                      aria-label="Submit rating"
                      onClick={submit}
                      disabled={!canSubmit}
                    >
                      <span data-node-id="36:4159">ENTER</span>
                      <span className="shrink-0" data-node-id="36:4160">
                        <EnterArrowIcon />
                      </span>
                    </RatingButton>
                  </div>
                ) : null}
              </div>
            ) : null}

            {isMenuMounted ? (
              <div
                className={[
                  "w-full",
                  "transition-opacity",
                  "duration-[2200ms]",
                  "ease-[cubic-bezier(0.16,1,0.3,1)]",
                  // Menu enters as an opacity-only fade (no translate).
                  isMenuVisible ? "opacity-100" : "opacity-0",
                  "motion-reduce:transition-none motion-reduce:opacity-100",
                ].join(" ")}
              >
                <HomeActionMenu />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </MeasuredWidthDiv>
  );
}
