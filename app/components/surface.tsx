import type { ComponentPropsWithoutRef, ReactNode } from "react";

type SurfaceTone = "glass" | "glass-soft";

export type SurfaceProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
  tone?: SurfaceTone;
};

const toneClass: Record<SurfaceTone, string> = {
  glass: "ch26-surface ch26-surface--glass",
  "glass-soft": "ch26-surface ch26-surface--glass-soft",
};

export default function Surface({
  children,
  tone = "glass",
  className,
  ...props
}: SurfaceProps) {
  return (
    <div {...props} className={[toneClass[tone], className].filter(Boolean).join(" ")}>
      {children}
    </div>
  );
}

