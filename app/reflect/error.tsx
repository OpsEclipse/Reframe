"use client";

import { useEffect } from "react";
import GlassButton from "../components/glass-button";

export default function ReflectError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Keep this minimal; route-level errors should be rare and actionable.
    console.error(error);
  }, [error]);

  return (
    <main className="group flex min-h-dvh items-stretch p-[clamp(16px,4vw,48px)]">
      <div className="flex flex-1 min-h-0 w-full items-center justify-center rounded-2xl border-2 border-black/20 bg-black/5 px-[clamp(24px,10vw,384px)] py-[clamp(24px,6vw,64px)]">
        <div className="w-full max-w-2xl rounded-2xl border border-white/10 bg-white/5 p-6 text-white backdrop-blur">
          <h1 className="text-lg font-semibold">Reflect hit an error</h1>
          <p className="mt-2 text-sm text-white/70">
            Try again. If it persists, check the console.
          </p>
          <div className="mt-4 flex items-center gap-3">
            <GlassButton type="button" onClick={reset} className="bg-white/10 text-white hover:bg-white/15">
              Retry
            </GlassButton>
          </div>
        </div>
      </div>
    </main>
  );
}
