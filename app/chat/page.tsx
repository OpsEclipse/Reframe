import type { Metadata } from "next";
import Link from "next/link";

import ChatClient from "./chat-client";

export const metadata: Metadata = {
  title: "Chat",
  description: "A sleek chat interface for a future RAG retrieval system.",
};

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(0,140,255,0.14),transparent_60%),radial-gradient(900px_500px_at_85%_25%,rgba(255,122,0,0.12),transparent_55%),linear-gradient(to_bottom,#fbfbfb,#f4f4f5)] dark:bg-[radial-gradient(1200px_600px_at_20%_10%,rgba(0,140,255,0.18),transparent_60%),radial-gradient(900px_500px_at_85%_25%,rgba(255,122,0,0.14),transparent_55%),linear-gradient(to_bottom,#050505,#0b0b0c)]">
      <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 py-10 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50">
              Ch26 Retrieval Chat
            </h1>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="inline-flex items-center rounded-full border border-black/10 bg-white/50 px-2.5 py-1 text-xs font-medium text-zinc-700 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                UI only
              </span>
              <span className="inline-flex items-center rounded-full border border-black/10 bg-white/50 px-2.5 py-1 text-xs font-medium text-zinc-700 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                RAG ready
              </span>
            </div>
          </div>
          <Link
            href="/"
            className="rounded-full border border-black/10 bg-white/50 px-3 py-1.5 text-sm font-medium text-zinc-800 backdrop-blur transition hover:bg-white/70 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
          >
            Home
          </Link>
        </header>

        <div className="relative flex-1 overflow-hidden rounded-3xl border border-black/10 bg-white/60 shadow-[0_10px_30px_-12px_rgba(0,0,0,0.25)] backdrop-blur-xl dark:border-white/10 dark:bg-white/5 dark:shadow-[0_10px_30px_-12px_rgba(0,0,0,0.65)]">
          <div className="pointer-events-none absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgba(0,0,0,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(0,0,0,0.04)_1px,transparent_1px)] [background-size:28px_28px] dark:opacity-40 dark:[background-image:linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.06)_1px,transparent_1px)]" />
          <div className="relative flex h-full flex-col">
            <ChatClient />
          </div>
        </div>

        <footer className="mt-6 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
          <p>
            Tip: Press <span className="font-mono">Enter</span> to send,{" "}
            <span className="font-mono">Shift+Enter</span> for a new line.
          </p>
          <p className="hidden sm:block">Built with Next + React, optimized for small client JS.</p>
        </footer>
      </div>
    </div>
  );
}
