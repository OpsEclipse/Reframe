"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
};

type GatekeeperMetadata = {
  reframed_query: string | null;
  emotions: string[] | null;
  people: string[] | null;
  keywords: string[] | null;
  date_int: number | null;
};

type GatekeeperApiResponse = {
  gatekeeper?: GatekeeperMetadata;
  rewritten_query?: string;
  embedding?: { model?: string; dims?: number; vector?: number[] };
  error?: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

const MAX_MESSAGE_LENGTH = 2000;
const AUTO_SCROLL_THRESHOLD_PX = 120;
const MAX_RENDERED_MESSAGES = 200;
const INPUT_HINTS = [
  "Summarize these docs",
  "What is the data model?",
  "Find code references",
];
const EMPTY_MESSAGE_FOOTER =
  "Currently: calls /api/gatekeeper and shows extracted metadata. Upcoming: retrieval + citations.";
const initialAssistantMessage =
  "Ask a question. For now this calls `/api/gatekeeper` and returns the Gatekeeper JSON (plus an embedding computed server-side).";

// Keep initial render deterministic to avoid hydration mismatches.
const WELCOME_MESSAGES: ChatMessage[] = [
  {
    id: "welcome",
    role: "assistant",
    content: initialAssistantMessage,
    createdAt: 0,
  },
];

function nowId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function formatTime(ts: number) {
  if (ts <= 0) return "";
  try {
    // Intentionally fixed locale so client formatting is stable (and only rendered after hydration).
    return new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(ts));
  } catch {
    return "";
  }
}

function createMessage(role: Role, content: string): ChatMessage {
  return {
    id: nowId(),
    role,
    content,
    createdAt: Date.now(),
  };
}

async function callGatekeeper(query: string): Promise<GatekeeperApiResponse | null> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const res = await fetch("/api/gatekeeper", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      query,
      timezone,
      embed: true,
      include_embedding_vector: false,
    }),
  });
  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      isRecord(json) && typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  return isRecord(json) ? (json as GatekeeperApiResponse) : null;
}

function formatGatekeeperAssistantText(payload: GatekeeperApiResponse | null) {
  const gatekeeper = payload?.gatekeeper ?? payload ?? null;
  const rewritten = typeof payload?.rewritten_query === "string" ? payload.rewritten_query : null;
  const embeddingModel =
    typeof payload?.embedding?.model === "string" ? payload.embedding.model : null;
  const embeddingDims =
    typeof payload?.embedding?.dims === "number" ? payload.embedding.dims : null;

  const parts: string[] = [];
  parts.push("Gatekeeper JSON:");
  parts.push(JSON.stringify(gatekeeper, null, 2));
  if (rewritten) {
    parts.push("");
    parts.push("Rewritten query:");
    parts.push(rewritten);
  }
  if (embeddingModel && embeddingDims) {
    parts.push("");
    parts.push(`Embedding: model=${embeddingModel}, dims=${embeddingDims}`);
  }
  return parts.join("\n");
}

const MessageBubble = memo(function MessageBubble({
  message,
}: {
  message: ChatMessage;
}) {
  const isUser = message.role === "user";
  const timeText = formatTime(message.createdAt);
  return (
    <div
      className={`flex w-full items-end gap-3 animate-[chatIn_240ms_ease-out] ${
        isUser ? "justify-end" : "justify-start"
      }`}
    >
      {!isUser ? (
        <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/60 text-[11px] font-semibold text-zinc-900 shadow-sm backdrop-blur sm:flex dark:border-white/10 dark:bg-white/5 dark:text-zinc-100">
          R
        </div>
      ) : null}
      <div
        className={`group relative max-w-[80%] whitespace-pre-wrap rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
          isUser
            ? "bg-[linear-gradient(180deg,#141414,#090909)] text-zinc-50 shadow-[0_18px_40px_-26px_rgba(0,0,0,0.85)]"
            : "border border-black/10 bg-white/70 text-zinc-950 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-50"
        }`}
      >
        {timeText ? (
          <div className="absolute -top-3 right-2 hidden select-none rounded-full border border-black/10 bg-white/80 px-2 py-0.5 text-[10px] font-medium text-zinc-700 opacity-0 shadow-sm backdrop-blur transition group-hover:opacity-100 dark:border-white/10 dark:bg-black/40 dark:text-zinc-200 sm:block">
            {timeText}
          </div>
        ) : null}
        {message.content}
      </div>
      {isUser ? (
        <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/60 text-[11px] font-semibold text-zinc-900 shadow-sm backdrop-blur sm:flex dark:border-white/10 dark:bg-white/5 dark:text-zinc-100">
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
        <div className="absolute -inset-10 rounded-full bg-[conic-gradient(from_220deg,rgba(0,110,255,0.22),rgba(255,135,0,0.18),rgba(0,110,255,0.22))] blur-2xl" />
        <div className="relative rounded-2xl border border-black/10 bg-white/70 px-5 py-4 text-sm text-zinc-900 shadow-sm backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-100">
          Ask anything. Soon this will retrieve context and answer with sources.
        </div>
      </div>
      <div className="flex flex-wrap justify-center gap-2 pt-2 text-xs text-zinc-600 dark:text-zinc-400">
        {INPUT_HINTS.map((hint) => (
          <span
            key={hint}
            className="rounded-full border border-black/10 bg-white/50 px-2 py-1 font-medium text-zinc-800 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-200"
          >
            &quot;{hint}&quot;
          </span>
        ))}
      </div>
    </div>
  );
});

export default function ChatClient() {
  const [messages, setMessages] = useState<ChatMessage[]>(() => [...WELCOME_MESSAGES]);
  const [input, setInput] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [showAllMessages, setShowAllMessages] = useState(false);

  const bottomRef = useRef<HTMLDivElement | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const isNearBottomRef = useRef(true);
  const forceAutoScrollRef = useRef(false);
  const messagesCount = messages.length;
  const inputCount = input.length;
  const trimmedInput = input.trim();

  const canSend =
    trimmedInput.length > 0 &&
    trimmedInput.length <= MAX_MESSAGE_LENGTH &&
    !isSending;

  const displayedMessages = showAllMessages
    ? messages
    : messages.slice(-MAX_RENDERED_MESSAGES);
  const hiddenMessagesCount = messages.length - displayedMessages.length;

  const updateIsNearBottom = useCallback(() => {
    const el = scrollContainerRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    isNearBottomRef.current = distanceFromBottom < AUTO_SCROLL_THRESHOLD_PX;
  }, []);

  const onScroll = useCallback(() => {
    updateIsNearBottom();
  }, [updateIsNearBottom]);

  const scrollToBottom = useCallback((behavior: ScrollBehavior) => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior });
  }, []);

  useEffect(() => {
    // Avoid yanking the scroll position when the user is reading earlier messages.
    // Also respect prefers-reduced-motion.
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
    const shouldAutoScroll =
      isNearBottomRef.current || forceAutoScrollRef.current;
    if (!shouldAutoScroll) return;
    forceAutoScrollRef.current = false;
    scrollToBottom(reduceMotion ? "auto" : "smooth");
  }, [messages.length, scrollToBottom]);

  const onSend = useCallback(async () => {
    if (isSending) return;
    const text = input.trim();
    if (!text) return;
    if (text.length > MAX_MESSAGE_LENGTH) return;

    setIsSending(true);
    setInput("");

    const userMsg = createMessage("user", text);

    forceAutoScrollRef.current = true;
    setMessages((prev) => [...prev, userMsg]);

    try {
      const payload = await callGatekeeper(text);
      const assistantMsg = createMessage("assistant", formatGatekeeperAssistantText(payload));
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Unknown error calling /api/gatekeeper";
      const assistantMsg = createMessage(
        "assistant",
        `Gatekeeper error:\n${msg}`,
      );
      setMessages((prev) => [...prev, assistantMsg]);
    } finally {
      setIsSending(false);
    }
  }, [input, isSending]);

  const onInputChange = useCallback(
    (event: ChangeEvent<HTMLTextAreaElement>) => {
      setInput(event.target.value);
    },
    [],
  );

  const onKeyDown = useCallback(
    (e: KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key !== "Enter") return;
      if (e.shiftKey) return;
      e.preventDefault();
      onSend();
    },
    [onSend],
  );

  const onFocus = useCallback(() => {
    textareaRef.current?.focus();
  }, []);

  const onClear = useCallback(() => {
    setMessages(() => {
      const message = createMessage(
        "assistant",
        "Cleared. Next step is wiring retrieval; for now each message returns Gatekeeper JSON + embedding dims.",
      );
      return [message];
    });
    setIsSending(false);
    setInput("");
    setShowAllMessages(false);
    onFocus();
  }, [onFocus]);

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
              Calls /api/gatekeeper
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onClear}
          className="rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-xs font-semibold text-zinc-900 backdrop-blur transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10 dark:focus-visible:ring-white/20"
        >
          Clear
        </button>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-5 py-6"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messagesCount <= 1 ? <EmptyState /> : null}
          {hiddenMessagesCount > 0 && !showAllMessages ? (
            <button
              type="button"
              onClick={() => setShowAllMessages(true)}
              className="mx-auto rounded-full border border-black/10 bg-white/60 px-3 py-1.5 text-[11px] font-semibold text-zinc-900 backdrop-blur transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10 dark:focus-visible:ring-white/20"
            >
              Show earlier messages ({hiddenMessagesCount} hidden)
            </button>
          ) : null}
          {displayedMessages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isSending ? (
            <div className="flex items-end gap-3">
              <div className="hidden h-8 w-8 shrink-0 items-center justify-center rounded-full border border-black/10 bg-white/60 text-[11px] font-semibold text-zinc-800 shadow-sm backdrop-blur sm:flex dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
                R
              </div>
              <div className="rounded-2xl border border-black/10 bg-white/70 px-4 py-3 text-sm text-zinc-800 backdrop-blur dark:border-white/10 dark:bg-white/5 dark:text-zinc-200">
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

      <div className="border-t border-black/10 bg-white/35 px-5 py-4 backdrop-blur dark:border-white/10 dark:bg-white/5">
        <div className="mx-auto w-full max-w-3xl">
          <div className="group relative rounded-2xl border border-black/10 bg-white/70 shadow-sm backdrop-blur transition focus-within:bg-white/80 focus-within:shadow-[0_16px_44px_-30px_rgba(0,0,0,0.55)] dark:border-white/10 dark:bg-black/20 dark:focus-within:bg-black/25">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={onInputChange}
              onKeyDown={onKeyDown}
              rows={2}
              placeholder="Ask a question…"
              className="block w-full resize-none rounded-2xl bg-transparent px-4 py-3 pr-24 text-sm leading-6 text-zinc-950 outline-none placeholder:text-zinc-500 dark:text-zinc-50 dark:placeholder:text-zinc-400"
            />
            <div className="absolute right-2 top-2 flex items-center gap-2">
              <button
                type="button"
                onClick={onFocus}
                className="hidden rounded-full border border-black/10 bg-white/60 px-3 py-2 text-xs font-semibold text-zinc-900 backdrop-blur transition hover:bg-white/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 sm:inline-flex dark:border-white/10 dark:bg-white/5 dark:text-zinc-100 dark:hover:bg-white/10 dark:focus-visible:ring-white/20"
              >
                Focus
              </button>
              <button
                type="button"
                onClick={onSend}
                disabled={!canSend}
                className={`inline-flex items-center justify-center rounded-full px-4 py-2 text-xs font-semibold transition ${
                  canSend
                    ? "bg-zinc-950 text-zinc-50 shadow-[0_12px_34px_-22px_rgba(0,0,0,0.75)] hover:bg-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-black/20 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-white dark:focus-visible:ring-white/20"
                    : "cursor-not-allowed border border-black/10 bg-white/40 text-zinc-500 dark:border-white/10 dark:bg-white/5 dark:text-zinc-400"
                }`}
              >
                {isSending ? "Sending…" : "Send"}
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center justify-between text-[11px] text-zinc-600 dark:text-zinc-400">
            <p className="truncate">
              {EMPTY_MESSAGE_FOOTER}
            </p>
            <p className="hidden sm:block">{inputCount}/{MAX_MESSAGE_LENGTH}</p>
          </div>
        </div>
      </div>
    </>
  );
}
