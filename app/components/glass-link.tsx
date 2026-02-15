import type { ComponentProps } from "react";
import Link from "next/link";

export type GlassLinkProps = ComponentProps<typeof Link> & {
  size?: "sm" | "xs";
};

const sizeClass: Record<NonNullable<GlassLinkProps["size"]>, string> = {
  sm: "text-sm",
  xs: "text-xs",
};

export default function GlassLink({ size = "sm", className, ...props }: GlassLinkProps) {
  return (
    <Link
      {...props}
      className={["ch26-button-glass", sizeClass[size], className].filter(Boolean).join(" ")}
    />
  );
}

