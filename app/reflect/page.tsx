import type { Metadata } from "next";
import AppPanel from "../components/app-panel";
import GlassLink from "../components/glass-link";

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
        <div className="relative flex h-full flex-col gap-6">
          <header className="flex items-center justify-between">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-50 sm:text-2xl">
              <span className="font-[var(--font-display)] tracking-[-0.02em]">Reflect</span>
            </h1>
            <GlassLink href="/" size="sm" className="bg-white/10 text-white hover:bg-white/15">
              Home
            </GlassLink>
          </header>

          <div className="min-h-0 flex-1">
            <p className="max-w-prose text-sm text-white/70">
              Placeholder route scaffold for <span className="font-mono">/reflect</span>.
            </p>
            <p className="mt-2 max-w-prose text-sm text-white/60">
              Add UI here. Keep the page server-rendered unless you truly need client state.
            </p>
          </div>
        </div>
      </AppPanel>
    </main>
  );
}
