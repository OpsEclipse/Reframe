import type { ComponentPropsWithoutRef, ReactNode } from "react";

import { Pangolin } from "next/font/google";

const pangolin = Pangolin({
  subsets: ["latin"],
  weight: "400",
});

export type ReframeCardProps = ComponentPropsWithoutRef<"div"> & {
  children: ReactNode;
};

export default function ReframeCard({ children, className, ...props }: ReframeCardProps) {
  return (
    <div
      {...props}
      className={[
        // Figma node 36:3770
        "bg-[#ded2c3]",
        "content-center flex flex-wrap items-center justify-center",
        "p-12",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      data-node-id="36:3770"
    >
      <p
        // Figma node 36:3771
        className={[
          pangolin.className,
          "flex-1 min-w-0",
          "text-[20px] leading-[1.5]",
          "font-normal not-italic",
          "text-black/40",
          "whitespace-pre-wrap",
        ].join(" ")}
        data-node-id="36:3771"
      >
        {children}
      </p>
    </div>
  );
}

