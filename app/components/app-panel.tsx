import type { ComponentPropsWithoutRef, ReactNode } from "react";

type AppPanelProps = ComponentPropsWithoutRef<"div"> & { children: ReactNode };

const basePanelClasses =
  "bg-gradient-to-b from-stone-900 to-stone-900/80 rounded-2xl shadow-[inset_0px_-24px_24px_0px_rgba(0,0,0,0.40)]";

export default function AppPanel({ children, className, ...props }: AppPanelProps) {
  return (
    <div
      {...props}
      className={className ? `${basePanelClasses} ${className}` : basePanelClasses}
    >
      {children}
    </div>
  );
}
