import type { ButtonHTMLAttributes } from "react";

export type GlassButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "sm" | "xs";
};

const sizeClass: Record<NonNullable<GlassButtonProps["size"]>, string> = {
  sm: "text-sm",
  xs: "text-xs",
};

export default function GlassButton({
  size = "sm",
  className,
  type,
  ...props
}: GlassButtonProps) {
  return (
    <button
      {...props}
      type={type ?? "button"}
      className={["ch26-button-glass", sizeClass[size], className].filter(Boolean).join(" ")}
    />
  );
}

