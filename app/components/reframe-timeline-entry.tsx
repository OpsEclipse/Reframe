import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type ReframeTimelineEntryProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  periodLabel: string;
  entriesCountLabel: string;
  periodLabelClassName?: string;
  entriesCountClassName?: string;
  children: ReactNode;
  onEntriesClick?: () => void;
  entriesButtonDisabled?: boolean;
  entriesButtonAriaLabel?: string;
};

export default function ReframeTimelineEntry({
  periodLabel,
  entriesCountLabel,
  periodLabelClassName,
  entriesCountClassName,
  children,
  onEntriesClick,
  entriesButtonDisabled = false,
  entriesButtonAriaLabel = "Open source preview",
  className,
  ...props
}: ReframeTimelineEntryProps) {
  const EntriesWrapper = onEntriesClick ? "button" : "div";
  return (
    <div
      {...props}
      // Figma node 36:3838
      className={["flex flex-col items-start gap-4", className].filter(Boolean).join(" ")}
      data-node-id="36:3838"
    >
      <div className="flex w-full items-start" data-node-id="36:3839">
        <div
          className={[
            "flex w-full items-center justify-between",
            "font-mono font-medium leading-normal",
            "text-[12px]",
          ].join(" ")}
          data-node-id="36:3840"
        >
          <p
            className={["shrink-0 text-white/40", periodLabelClassName].filter(Boolean).join(" ")}
            data-node-id="36:3841"
          >
            {periodLabel}
          </p>

          <EntriesWrapper
            {...(onEntriesClick
              ? {
                  type: "button" as const,
                  onClick: onEntriesClick,
                  disabled: entriesButtonDisabled,
                  "aria-label": entriesButtonAriaLabel,
                }
              : {})}
            className={[
              "shrink-0",
              "flex items-center gap-1",
              "rounded-[4px] bg-white/5 px-2 py-1",
              "text-[10px]",
              onEntriesClick
                ? "transition hover:bg-white/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/20 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-white/5"
                : "",
            ]
              .filter(Boolean)
              .join(" ")}
            data-node-id="36:3842"
          >
            <p
              className={["shrink-0 text-white/60", entriesCountClassName].filter(Boolean).join(" ")}
              data-node-id="36:3843"
            >
              {entriesCountLabel}
            </p>
            <p className="shrink-0 text-white/25" data-node-id="36:3844">
              ENTRIES
            </p>
          </EntriesWrapper>
        </div>
      </div>

      <div
        className="flex w-full max-w-[491px] items-center gap-4"
        data-node-id="36:3845"
      >
        <div className="flex self-stretch items-center" data-node-id="36:3846">
          {/* Figma uses a 1px SVG line with 40% white; render it in CSS to avoid an extra asset request. */}
          <div className="w-px self-stretch bg-white/40" aria-hidden="true" />
        </div>

        <div className="flex min-w-0 flex-1 flex-col items-start" data-node-id="36:3847">
          <p
            className={[
              "w-full whitespace-pre-wrap",
              "font-[var(--font-inter)] font-medium not-italic leading-[1.5]",
              "text-[16px] text-white/90",
            ].join(" ")}
            data-node-id="36:3848"
          >
            {children}
          </p>
        </div>
      </div>
    </div>
  );
}
