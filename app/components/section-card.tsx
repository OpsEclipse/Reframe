import type { ReactNode } from "react";

import Surface from "./surface";

export type SectionCardProps = {
  title: ReactNode;
  meta?: ReactNode;
  children: ReactNode;
  tone?: "glass" | "glass-soft";
  className?: string;
  bodyClassName?: string;
};

export default function SectionCard({
  title,
  meta,
  children,
  tone = "glass",
  className,
  bodyClassName = "p-4",
}: SectionCardProps) {
  return (
    <div className={["w-full", className].filter(Boolean).join(" ")}>
      <div
        className={
          meta
            ? "mb-3 flex items-center justify-between gap-3"
            : "mb-3"
        }
      >
        <div className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">{title}</div>
        {meta ? (
          <div className="shrink-0 text-[11px] font-medium text-zinc-600 dark:text-zinc-400">
            {meta}
          </div>
        ) : null}
      </div>
      <Surface tone={tone} className={bodyClassName}>
        {children}
      </Surface>
    </div>
  );
}

