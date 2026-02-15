"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
};

function nowId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatTime(ts: number) {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

function makeAssistantReply(userText: string) {
  const trimmed = userText.trim();
  if (!trimmed) return "Say something and I will respond.";
  return [
    "UI stub: RAG is not wired yet.",
    "",
    "What I will do once retrieval is connected:",
    "- rewrite your question if needed",
    "- fetch relevant chunks",
    "- answer with citations/snippets",
    "",
    `You said: “${trimmed.length > 240 ? `${trimmed.slice(0, 240)}…` : trimmed}”`,
  ].join("\n");
}

const MessageBubble = memo(function MessageBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.role === "user";
  return (
    <div
      className={[
        "flex w-full items-end gap-3",
        isUser ? "justify-end" : "justify-start",
      ].join(" ")}
    >
      {!isUser ? (
        <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/60 text-[11px] font-semibold text-zinc-800 shadow-sm backdrop-blur sm:flex dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
          R
        </div>
      ) : null}
      <div
        className={[
          "group relative max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm",
          isUser
            ? "bg-zinc-950 text-zinc-50 shadow-[0_12px_30px_-18px_rgba(0,0,0,0.7)]"
            : "border border-black/10 bg-white/70 text-zinc-900 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-100",
        ].join(" ")}
      >
        <div className="absolute -top-3 right-2 hidden select-none rounded-full border border-black/10 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-zinc-700 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 dark:border-white/10 dark:bg-black/40 dark:text-zinc-200 sm:block">
          {formatTime(message.createdAt)}
        </div>
        {message.content}
      </div>
      {isUser ? (
        <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/60 text-[11px] font-semibold text-zinc-800 shadow-sm backdrop-blur sm:flex dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
          U
        </div>
      ) : null}
    </div>
  );
});

const EmptyState = memo(function EmptyState() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="relative">
        <div className="absolute -inset-8 rounded-full bg-[conic-gradient(from_210deg,rgba(0,140,255,0.22),rgba(255,122,0,0.18),rgba(0,140,255,0.22))] blur-2xl" />
        <div className="relative rounded-2xl border border-black/10 bg-white/70 px-5 py-4 text-sm text-zinc-800 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
          Ask anything. Soon this will retrieve context and answer with sources.
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2 pt-2 text-xs text-zinc-600 dark:text-zinc-400">
        <span className="rounded-full border border-black/10 bg-white/50 px-2 py-1 backdrop-blur dark:border-white/10 dark:bg-white/5">
          &quot;Summarize these docs&quot;
        </span>
        <span className="rounded-full border border-black/10 bg-white/50 px-2 py-1 backdrop-blur dark:border-white/10 dark:bg-white/5">
          &quot;What is the data model?&quot;
        </span>
        <span className="rounded-full border border-black/10 bg-white/50 px-2 py-1 backdrop-blur dark:border-white/10 dark:bg-white/5">
          &quot;Find code references&quot;
        </span>
      </div>
    </div>
  );
});

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [
    {
      id: nowId(),
      role: "assistant",
      content:
        "Drop a question here. For now this is a UI-only stub; next step is wiring a `/api/chat` route to your retriever + model.",
      createdAt: Date.now(),
    },
  ]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !isSending, [input, isSending]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages.length, scrollToBottom]);

  const onSend = useCallback(() => {
    const text = input.trim();
    if (!text || isSending) return;

    setIsSending(true);
    setInput("");

    const userMsg: ChatMessage = {
      id: nowId(),
      role: "user",
      content: text,
      createdAt: Date.now(),
    };

    setMessages((prev) => [...prev, userMsg]);

    // UI-only stub: mimic latency and add an assistant reply without any network calls.
    window.setTimeout(() => {
      const assistantMsg: ChatMessage = {
        id: nowId(),
        role: "assistant",
        content: makeAssistantReply(text),
        createdAt: Date.now(),
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setIsSending(false);
    }, 420);
  }, [input, isSending]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return;
      e.preventDefault();
      onSend();
    },
    [onSend],
  );

  const onClear = useCallback(() => {
    setMessages([
      {
        id: nowId(),
        role: "assistant",
        content:
          "Cleared. When you are ready, I can be wired to retrieval and show citations per message.",
        createdAt: Date.now(),
      },
    ]);
    setInput("");
    textareaRef.current?.focus();
  }, []);

  return (
    <>
      <div className="flex items-center justify-between border-b border-black/10 px-5 py-4 dark:border-white/10">
        <div className="flex items-center gap-3">
          <div className="h-2.5 w-2.5 rounded-full bg-emerald-500 shadow-[0_0_0_4px_rgba(16,185,129,0.18)]" />
          <div className="leading-tight">
            <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-50">
              Retrieval Chat
            </p>
            <p className="text-xs text-zinc-600 dark:text-zinc-400">
              Local UI stub, no network yet
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-xs font-semibold text-zinc-800 backdrop-blur transition hover:bg-white/80 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
        >
          Clear
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-6">
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messages.length <= 1 ? <EmptyState /> : null}
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isSending ? (
            <div className="flex items-end gap-3">
              <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/60 text-[11px] font-semibold text-zinc-800 shadow-sm backdrop-blur sm:flex dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                R
              </div>
              <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-700 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-[pulse_1.1s_ease-in-out_infinite] rounded-full bg-zinc-500/70" />
                  <span className="h-1.5 w-1.5 animate-[pulse_1.1s_ease-in-out_infinite_0.2s] rounded-full bg-zinc-500/70" />
                  <span className="h-1.5 w-1.5 animate-[pulse_1.1s_ease-in-out_infinite_0.4s] rounded-full bg-zinc-500/70" />
                </span>
              </div>
            </div>
          ) : null}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="border-t border-black/10 bg-white/40 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="mx-auto w-full max-w-3xl">
          <div className="relative rounded-2xl border border-black/10 bg-white/70 shadow-sm backdrop-blur dark:border-white/10 dark:bg-black/20">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Ask a question…"
              className="block w-full resize-none rounded-2xl bg-transparent px-4 py-3 pr-24 text-sm leading-6 text-zinc-950 outline-none placeholder:text-zinc-500 dark:text-zinc-50 dark:placeholder:text-zinc-400"
            />
            <div className="absolute right-2 top-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => textareaRef.current?.focus()}
                className="hidden rounded-full border border-black/10 bg-white/60 px-3 py-2 text-xs font-semibold text-zinc-800 backdrop-blur transition hover:bg-white/80 sm:inline-flex dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10"
              >
                Focus
              </button>
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                className={[
                  "inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition",
                  canSend
                    ? "bg-zinc-950 text-zinc-50 hover:bg-zinc-900 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white"
                    : "cursor-not-allowed border border-black/10 bg-white/40 text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400",
                ].join(" ")}
              >
                {isSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
            <p className="truncate">
              Upcoming: citations, source cards, and a streaming assistant response.
            </p>
            <p className="hidden sm:block">{input.trim().length}/2000</p>
          </div>
        </div>
      </div>
    </>
  );
}
