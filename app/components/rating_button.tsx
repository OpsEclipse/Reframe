"use client";

import type { ComponentPropsWithoutRef } from "react";
import { forwardRef } from "react";

type RatingButtonProps = ComponentPropsWithoutRef<"button"> & {
  active?: boolean;
  variant?: "rating" | "enter";
  dataNodeId?: string;
};

export function EnterArrowIcon() {
  // Inline SVG to avoid adding a full icon dependency for a single glyph.
  return (
    <svg
      aria-hidden="true"
      focusable="false"
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      className="block"
    >
      <path
        d="M9 10L5 14L9 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 5V11C20 13.2091 18.2091 15 16 15H5"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const baseClasses = [
  // Layout
  "inline-flex items-center justify-center",
  "shrink-0",
  "gap-[8px]",
  "rounded-[3px]",
  "border border-white/20",
  // Reduce perceived tap delay on touch devices.
  "touch-manipulation",
  // Typography
  "font-[var(--font-inter)] font-normal",
  "leading-[normal] not-italic",
  // Interaction
  "transition-colors duration-150 ease-out",
  // A11y
  "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]",
  "disabled:cursor-not-allowed disabled:opacity-50",
].join(" ");

const ratingSizeClasses = [
  // Match Figma sizing exactly (70.4 x 48)
  "w-[70.4px] h-[48px]",
  "px-[24px] py-[12px]",
  "text-[20px]",
].join(" ");

const enterSizeClasses = [
  // Figma node 36:4158
  "px-[16px] py-[8px]",
  "text-[16px]",
].join(" ");

const inactiveClasses = [
  // Non-active style (Figma node 36:4001)
  "bg-transparent text-white/80",
  "enabled:hover:bg-white/5 enabled:hover:text-white/90 enabled:hover:border-white/30",
].join(" ");

const activeClasses = [
  // Active style (Figma node 36:4003)
  "bg-white/90 text-[#1e1e1e]",
  "enabled:hover:bg-white enabled:hover:border-white/30",
].join(" ");

type RatingKeycapProps = {
  active?: boolean;
  variant?: "rating" | "enter";
  dataNodeId?: string;
} & ComponentPropsWithoutRef<"div">;

// Use this when you need the same visual "keycap" but cannot nest a <button> (e.g. inside another button).
export function RatingKeycap({
  active = false,
  variant = "rating",
  dataNodeId: dataNodeIdProp,
  className,
  ...props
}: RatingKeycapProps) {
  const dataNodeId = dataNodeIdProp ?? (active ? "36:4003" : "36:4001");

  return (
    <div
      {...props}
      data-state={active ? "active" : "inactive"}
      data-node-id={dataNodeId}
      className={[
        baseClasses,
        // Remove button-only concerns.
        "cursor-default",
        "focus-visible:outline-none",
        variant === "rating" ? ratingSizeClasses : enterSizeClasses,
        active ? activeClasses : inactiveClasses,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
}

export default forwardRef<HTMLButtonElement, RatingButtonProps>(function RatingButton(
  { active = false, variant = "rating", dataNodeId: dataNodeIdProp, className, type, ...props },
  ref,
) {
  const computedType = type ?? "button";
  const dataNodeId = dataNodeIdProp ?? (active ? "36:4003" : "36:4001");
  const ariaPressed = props["aria-pressed"] ?? (variant === "rating" ? active : undefined);

  return (
    <button
      {...props}
      ref={ref}
      type={computedType}
      aria-pressed={ariaPressed}
      data-state={active ? "active" : "inactive"}
      data-node-id={dataNodeId}
      className={[
        baseClasses,
        "cursor-pointer",
        variant === "rating" ? ratingSizeClasses : enterSizeClasses,
        active ? activeClasses : inactiveClasses,
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    />
  );
});
