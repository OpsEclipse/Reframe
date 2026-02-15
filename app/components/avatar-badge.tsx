import type { ComponentPropsWithoutRef, ReactNode } from "react";

export type AvatarBadgeProps = Omit<ComponentPropsWithoutRef<"div">, "children"> & {
  children: ReactNode;
};

export default function AvatarBadge({ children, className, ...props }: AvatarBadgeProps) {
  return (
    <div
      {...props}
      className={[
        "hidden h-8 w-8 shrink-0 items-center justify-center",
        "rounded-full border border-black/10",
        "bg-white/60",
        "text-[11px] font-semibold text-zinc-900 shadow-sm",
        "backdrop-blur",
        "sm:flex",
        "dark:border-white/10 dark:bg-white/5 dark:text-zinc-100",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </div>
  );
}

