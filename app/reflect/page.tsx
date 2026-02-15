import type { Metadata } from "next";
import AppPanel from "../components/app-panel";
import ReflectClient from "./reflect-client";

export const metadata: Metadata = {
  title: "Reflect",
  description: "A lightweight space to reflect and capture notes.",
};

export default function ReflectPage() {
  return (
    <main
      id="ch26-reflect"
      className="group flex min-h-dvh items-stretch p-[clamp(16px,4vw,48px)]"
      data-ch26-stage="final"
    >
      <AppPanel
        className={[
          "relative flex flex-1 min-h-0 w-full overflow-hidden",
          "border-2 border-black/50",
          // Match the home page spacing so /reflect sits in the same shell.
          "px-[clamp(24px,10vw,384px)] py-[clamp(24px,6vw,64px)]",
        ].join(" ")}
      >
        <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(115deg,rgba(0,0,0,0.05)_0,rgba(0,0,0,0.05)_1px,transparent_1px,transparent_14px)]" />
        <div className="relative flex h-full w-[70%] min-h-0 mx-auto flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain pr-2">
            <ReflectClient />
          </div>
        </div>
      </AppPanel>
    </main>
  );
}
