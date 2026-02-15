import type { Metadata } from "next";
import AppPanel from "../components/app-panel";
import GlassLink from "../components/glass-link";
import Pill from "../components/pill";
import ChatClient from "./chat-client";

export const metadata: Metadata = {
  title: "Chat",
  description: "A sleek chat interface for a future RAG retrieval system.",
};

export default function ChatPage() {
  return (
    <div className="ch26-chat-shell dark">
      <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-10 sm:px-6">
        <header className="mb-6 flex items-center justify-between">
          <div className="flex items-baseline gap-3">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-50 sm:text-2xl">
              <span className="font-[var(--font-display)] tracking-[-0.02em]">
              Ch26 Retrieval Chat
              </span>
            </h1>
            <div className="hidden items-center gap-2 sm:flex">
              <Pill size="sm" tone="default">
                UI only
              </Pill>
              <Pill size="sm" tone="default">
                RAG ready
              </Pill>
            </div>
          </div>
          <GlassLink href="/" size="sm" className="bg-white/50 hover:bg-white/70">
            Home
          </GlassLink>
        </header>

        <AppPanel className="relative flex-1 overflow-hidden border-2 border-black/50">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_420px_at_20%_10%,rgba(0,110,255,0.10),transparent_62%),radial-gradient(780px_460px_at_86%_18%,rgba(255,135,0,0.10),transparent_60%)] opacity-80" />
          <div className="pointer-events-none absolute inset-0 opacity-25 [background-image:repeating-linear-gradient(115deg,rgba(0,0,0,0.05)_0,rgba(0,0,0,0.05)_1px,transparent_1px,transparent_14px)] dark:opacity-20 dark:[background-image:repeating-linear-gradient(115deg,rgba(255,255,255,0.06)_0,rgba(255,255,255,0.06)_1px,transparent_1px,transparent_14px)]" />
          <div className="relative flex h-full flex-col">
            <ChatClient />
          </div>
        </AppPanel>

        <footer className="mt-6 flex items-center justify-between text-xs text-zinc-600 dark:text-zinc-400">
          <p>
            Tip: Press <span className="font-mono">Enter</span> to send,{" "}
            <span className="font-mono">Shift+Enter</span> for a new line.
          </p>
          <p className="hidden sm:block">Server-rendered shell, minimal client JS.</p>
        </footer>
      </div>
    </div>
  );
}
