"use client";

import { useCallback, useEffect, useState } from "react";
import type { ComponentPropsWithoutRef, KeyboardEvent as ReactKeyboardEvent } from "react";
import { useRouter } from "next/navigation";

import RatingButton, { EnterArrowIcon } from "./rating_button";

type ActionRowProps = {
  index: number;
  title: string;
  description: string;
  titleFont?: "manrope" | "inter";
  isActive?: boolean;
  isInitialFocus?: boolean;
  onActivate?: () => void;
} & Omit<ComponentPropsWithoutRef<"button">, "children">;

function ActionRow({
  index,
  title,
  description,
  titleFont = "manrope",
  isActive = false,
  isInitialFocus = false,
  className,
  onActivate,
  ...props
}: ActionRowProps) {
  const titleFontClass =
    titleFont === "inter" ? "font-[var(--font-inter)] not-italic" : "font-[var(--font-manrope)]";

  return (
    <div
      className={[
        "w-full",
        "flex items-center gap-[24px]",
        "text-left",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-node-id={index === 1 ? "30:2328" : "30:2334"}
    >
      <RatingButton
        active={isActive}
        type="button"
        role="radio"
        aria-checked={isActive}
        tabIndex={isActive || isInitialFocus ? 0 : -1}
        onPointerDown={onActivate ? () => onActivate() : undefined}
        onClick={onActivate ? () => onActivate() : undefined}
        {...props}
        dataNodeId={index === 1 ? "36:3667" : "36:3670"}
        // Match rating button look, but use a square footprint for the action keycaps.
        className="w-[48px] h-[48px] p-0"
      >
        {index}
      </RatingButton>

      <div
        className={[
          "min-w-0 flex-1",
          "flex flex-col items-start gap-[4px]",
        ].join(" ")}
        data-node-id={index === 1 ? "30:2331" : "30:2337"}
      >
        <div
          className={[
            "w-full",
            titleFontClass,
            "font-medium",
            "text-[16px] leading-[normal]",
            "text-white/90",
          ].join(" ")}
          data-node-id={index === 1 ? "30:2332" : "30:2338"}
        >
          {title}
        </div>

        <div
          className={[
            "w-full",
            "font-[var(--font-manrope)] font-medium",
            "text-[14px] leading-[1.5]",
            "text-white/60",
          ].join(" ")}
          data-node-id={index === 1 ? "30:2333" : "30:2339"}
        >
          {description}
        </div>
      </div>
    </div>
  );
}

export default function HomeActionMenu() {
  const router = useRouter();
  const [selectedAction, setSelectedAction] = useState<1 | 2 | null>(null);
  const canProceed = selectedAction !== null;

  const setActionWithKeyboard = (value: 1 | 2) => () => setSelectedAction(value);

  const proceed = useCallback(() => {
    if (selectedAction === 1) {
      router.push("/reflect");
      return;
    }

    if (selectedAction === 2) {
      router.push("/chat");
    }
  }, [router, selectedAction]);

  useEffect(() => {
    if (!canProceed) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter") return;
      if (event.defaultPrevented) return;
      if (event.isComposing) return;
      if (event.metaKey || event.altKey || event.ctrlKey || event.shiftKey) return;

      event.preventDefault();
      proceed();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [canProceed, proceed]);

  const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      setSelectedAction((current) => (current === 1 ? 2 : 1));
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      setSelectedAction((current) => (current === 2 ? 1 : 2));
    }
  };

  return (
    <div
      role="radiogroup"
      aria-labelledby="ch26-home-action-menu-title"
      onKeyDown={onKeyDown}
      className="flex flex-col items-start justify-center w-full"
      data-node-id="30:2321"
      data-name="Frame 215"
    >
      <div
        className="flex flex-col items-start gap-[32px] shrink-0 w-[384px]"
        data-node-id="30:3037"
      >
        <div className="w-full" data-node-id="30:2322">
          <div className="w-full" data-node-id="30:2324">
            <p
              id="ch26-home-action-menu-title"
              className={[
                "m-0 w-full",
                "font-[var(--font-manrope)] font-semibold",
                "text-[20px] leading-[normal]",
                "tracking-[-0.3px]",
                "text-white/90",
              ].join(" ")}
              data-node-id="30:2325"
            >
              What would you like to do today?
            </p>
          </div>
        </div>

        <div
          className="w-full flex flex-col items-start gap-[16px]"
          data-node-id="30:2327"
        >
          <ActionRow
            index={1}
            isActive={selectedAction === 1}
            isInitialFocus={selectedAction === null}
            onActivate={setActionWithKeyboard(1)}
            title="REFLECT"
            description="Explore a past journal entry and uncover insights or patterns you couldn’t see at the time"
          />
          <ActionRow
            index={2}
            isActive={selectedAction === 2}
            onActivate={setActionWithKeyboard(2)}
            title="WRITE"
            titleFont="inter"
            description="Record your current thoughts and feelings to build your ongoing personal archive"
          />

          {selectedAction !== null ? (
            <div className="pt-[8px]">
              <RatingButton
                variant="enter"
                dataNodeId="36:4158"
                aria-label="Continue"
                onClick={proceed}
                disabled={!canProceed}
              >
                <span data-node-id="36:4159">ENTER</span>
                <span className="shrink-0" data-node-id="36:4160">
                  <EnterArrowIcon />
                </span>
              </RatingButton>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
