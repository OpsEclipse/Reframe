import type { ComponentPropsWithoutRef, ReactNode } from "react";

type PillTone = "muted" | "default" | "strong";
type PillSize = "xs" | "sm" | "hint";

export type PillProps = Omit<ComponentPropsWithoutRef<"span">, "children"> & {
  children: ReactNode;
  tone?: PillTone;
  size?: PillSize;
};

const toneClass: Record<PillTone, string> = {
  muted: "ch26-pill--muted",
  default: "ch26-pill--default",
  strong: "ch26-pill--strong",
};

const sizeClass: Record<PillSize, string> = {
  xs: "ch26-pill--xs",
  sm: "ch26-pill--sm",
  hint: "ch26-pill--hint",
};

export default function Pill({
  children,
  tone = "default",
  size = "xs",
  className,
  ...props
}: PillProps) {
  return (
    <span
      {...props}
      className={["ch26-pill", sizeClass[size], toneClass[tone], className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </span>
  );
}

