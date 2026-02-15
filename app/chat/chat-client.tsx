"use client";

import {
  memo,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import type { ChatGenerateResponse, SourceCitation } from "@/lib/rag-answer";
import { normalizeSourceCitations } from "@/app/chat/source-citations";
import AvatarBadge from "@/app/components/avatar-badge";
import GlassButton from "@/app/components/glass-button";
import JsonDetails from "@/app/components/json-details";
import Pill from "@/app/components/pill";
import SectionCard from "@/app/components/section-card";
import Surface from "@/app/components/surface";

type Role = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  createdAt: number;
  sources?: SourceCitation[] | null;
  gatekeeperPayload?: GatekeeperApiResponse | null;
  retrievePayload?: RetrieveApiResponse | null;
  retrieveError?: string | null;
};

type GatekeeperMetadata = {
  skip_RAG: boolean;
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

type RetrieveStats = {
  top_k: number;
  blend_ratio: number;
  base_top_k: number;
  matched_top_k: number;
  base_count: number;
  matched_count: number;
  union_count: number;
};

type RankedChunk = {
  id: string;
  pineconeScore: number;
  metadata?: Record<string, unknown>;
  match_reasons: { emotions: string[]; people: string[]; keywords: string[] };
  precedence: {
    avgCoverage: number;
    facetMatchedCount: number;
    totalHits: number;
    pineconeScore: number;
  };
};

type RetrieveApiResponse = {
  rewritten_query?: string;
  stats?: RetrieveStats;
  chunks?: RankedChunk[];
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
  "Currently: calls /api/chat and shows parsed Sources under the assistant response.";
const initialAssistantMessage =
  "Ask a question. This calls `/api/chat` (gatekeeper + retrieve + generate) and renders Sources under the assistant response.";

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

async function callChat(query: string): Promise<ChatGenerateResponse> {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const res = await fetch("/api/chat", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query, timezone }),
  });

  const json: unknown = await res.json().catch(() => null);
  if (!res.ok) {
    const msg =
      isRecord(json) && typeof json.error === "string" ? json.error : `HTTP ${res.status}`;
    throw new Error(msg);
  }
  if (!isRecord(json)) throw new Error("Empty/invalid response from /api/chat");
  return json as ChatGenerateResponse;
}

function isNonEmptyStringArray(x: unknown): x is string[] {
  return Array.isArray(x) && x.length > 0 && x.every((v) => typeof v === "string");
}

function NullPill() {
  return (
    <Pill tone="muted" size="xs">
      null
    </Pill>
  );
}

function FieldRow({
  k,
  children,
}: {
  k: string;
  children: ReactNode;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 py-2">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-zinc-600 dark:text-zinc-400">
        {k}
      </div>
      <div className="min-w-0 text-sm text-zinc-950 dark:text-zinc-50">{children}</div>
    </div>
  );
}

function GatekeeperCard({ payload }: { payload: GatekeeperApiResponse }) {
  const meta = payload.gatekeeper;
  const rewritten =
    typeof payload.rewritten_query === "string" && payload.rewritten_query.trim()
      ? payload.rewritten_query.trim()
      : null;
  const embeddingModel =
    typeof payload.embedding?.model === "string" ? payload.embedding.model : null;
  const embeddingDims =
    typeof payload.embedding?.dims === "number" ? payload.embedding.dims : null;

  const metaText =
    embeddingModel && embeddingDims
      ? `Embedding: ${embeddingModel}, dims ${embeddingDims}`
      : null;

  return (
    <SectionCard title="Gatekeeper Metadata" meta={metaText}>
      {meta ? (
        <>
          <FieldRow k="skip_RAG">
            <Pill tone="strong" size="xs">
              {meta.skip_RAG ? "true" : "false"}
            </Pill>
          </FieldRow>

          <div className="ch26-divider" />

          <FieldRow k="reframed_query">
            {meta.reframed_query ? (
              <span className="break-words">{meta.reframed_query}</span>
            ) : (
              <NullPill />
            )}
          </FieldRow>

          <div className="ch26-divider" />

          <FieldRow k="emotions">
            {isNonEmptyStringArray(meta.emotions) ? (
              <div className="flex flex-wrap gap-2">
                {meta.emotions.map((e) => (
                  <Pill key={e} tone="strong" size="xs">
                    {e}
                  </Pill>
                ))}
              </div>
            ) : (
              <NullPill />
            )}
          </FieldRow>

          <div className="ch26-divider" />

          <FieldRow k="people">
            {isNonEmptyStringArray(meta.people) ? (
              <div className="flex flex-wrap gap-2">
                {meta.people.map((p) => (
                  <Pill key={p} tone="strong" size="xs">
                    {p}
                  </Pill>
                ))}
              </div>
            ) : (
              <NullPill />
            )}
          </FieldRow>

          <div className="ch26-divider" />

          <FieldRow k="keywords">
            {isNonEmptyStringArray(meta.keywords) ? (
              <div className="flex flex-wrap gap-2">
                {meta.keywords.map((kw) => (
                  <Pill key={kw} tone="strong" size="xs">
                    {kw}
                  </Pill>
                ))}
              </div>
            ) : (
              <NullPill />
            )}
          </FieldRow>

          <div className="ch26-divider" />

          <FieldRow k="date_int">
            {typeof meta.date_int === "number" ? (
              <span className="font-mono text-sm">{meta.date_int}</span>
            ) : (
              <NullPill />
            )}
          </FieldRow>

          {rewritten ? (
            <>
              <div className="ch26-divider" />
              <FieldRow k="rewritten_query">
                <span className="break-words">{rewritten}</span>
              </FieldRow>
            </>
          ) : null}

          <JsonDetails value={meta} />
        </>
      ) : (
        <div className="text-sm text-zinc-800 dark:text-zinc-200">
          Gatekeeper returned no metadata.
        </div>
      )}
    </SectionCard>
  );
}

function pickFirstString(meta: Record<string, unknown> | undefined, keys: string[]): string | null {
  if (!meta) return null;
  for (const k of keys) {
    const v = meta[k];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function TopChunksCard({
  payload,
  error,
}: {
  payload?: RetrieveApiResponse | null;
  error?: string | null;
}) {
  if (error) {
    return (
      <SectionCard title="Top Chunks">
        <div className="text-sm text-zinc-800 dark:text-zinc-200">Retrieve error: {error}</div>
      </SectionCard>
    );
  }

  const chunks = Array.isArray(payload?.chunks) ? payload!.chunks! : [];
  const stats = payload?.stats;
  const metaText = stats ? `${stats.union_count} union, ${chunks.length} shown` : null;

  return (
    <SectionCard title="Top Chunks" meta={metaText}>
      <div>
        {chunks.length ? (
          <div className="flex flex-col gap-4">
            {chunks.map((c, idx) => {
              const meta = c.metadata;
              const title =
                pickFirstString(meta, ["title", "source", "file", "path", "url"]) ??
                `Chunk ${idx + 1}`;
              const preview = pickFirstString(meta, [
                "text",
                "content",
                "chunk",
                "excerpt",
                "body",
              ]);

              const reasons = c.match_reasons ?? { emotions: [], people: [], keywords: [] };
              const hasReasons =
                reasons.emotions.length || reasons.people.length || reasons.keywords.length;

              return (
                <Surface key={c.id} tone="glass-soft" className="rounded-xl p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                        {title}
                      </div>
                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                        <span className="font-mono">id {c.id}</span>
                        <span className="font-mono">
                          score{" "}
                          {Number.isFinite(c.pineconeScore) ? c.pineconeScore.toFixed(3) : "0.000"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {preview ? (
                    <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">
                      {preview.length > 600 ? `${preview.slice(0, 600)}…` : preview}
                    </p>
                  ) : meta ? (
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-black/5 p-2 text-[11px] leading-5 text-zinc-900 dark:bg-white/5 dark:text-zinc-100">
                      {JSON.stringify(meta, null, 2)}
                    </pre>
                  ) : null}

                  <div className="mt-2">
                    {hasReasons ? (
                      <div className="flex flex-wrap gap-2">
                        {reasons.emotions.map((e) => (
                          <Pill key={`e:${c.id}:${e}`} tone="strong" size="xs">
                            emotion:{e}
                          </Pill>
                        ))}
                        {reasons.people.map((p) => (
                          <Pill key={`p:${c.id}:${p}`} tone="strong" size="xs">
                            person:{p}
                          </Pill>
                        ))}
                        {reasons.keywords.map((k) => (
                          <Pill key={`k:${c.id}:${k}`} tone="strong" size="xs">
                            keyword:{k}
                          </Pill>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-zinc-600 dark:text-zinc-400">
                        No facet matches (semantic-only).
                      </div>
                    )}
                  </div>
                </Surface>
              );
            })}
          </div>
        ) : (
          <div className="text-sm text-zinc-800 dark:text-zinc-200">
            No chunks returned.
          </div>
        )}
        {payload ? <JsonDetails value={payload} /> : null}
      </div>
    </SectionCard>
  );
}

const SourcesCard = memo(function SourcesCard({
  sources,
}: {
  sources: SourceCitation[];
}) {
  if (!sources.length) return null;

  return (
    <SectionCard title="Sources" meta={`${sources.length} shown`}>
      <div className="flex flex-col gap-4">
        {sources.map((s) => {
          const title =
            (typeof s.title === "string" && s.title.trim()
              ? s.title.trim()
              : typeof s.source === "string" && s.source.trim()
                ? s.source.trim()
                : null) ?? `Chunk ${s.id}`;
          const score =
            typeof s.score === "number" && Number.isFinite(s.score)
              ? s.score.toFixed(3)
              : null;
          const preview =
            typeof s.preview === "string" && s.preview.trim() ? s.preview.trim() : null;

          return (
            <Surface key={s.id} tone="glass-soft" className="rounded-xl p-3">
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-50">
                  {title}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-zinc-600 dark:text-zinc-400">
                  <span className="font-mono">id {s.id}</span>
                  {score ? <span className="font-mono">score {score}</span> : null}
                  {typeof s.source === "string" && s.source.trim() ? (
                    <span className="truncate">{s.source.trim()}</span>
                  ) : null}
                </div>
              </div>

              {preview ? (
                <p className="mt-2 whitespace-pre-wrap text-sm text-zinc-900 dark:text-zinc-100">
                  {preview.length > 600 ? `${preview.slice(0, 600)}…` : preview}
                </p>
              ) : null}
            </Surface>
          );
        })}
      </div>
    </SectionCard>
  );
});

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
        <AvatarBadge>R</AvatarBadge>
      ) : null}
      <div
        className={`group relative max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
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

        {isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <div className="flex w-full flex-col gap-3">
            <span className="whitespace-pre-wrap">{message.content}</span>
            {Array.isArray(message.sources) && message.sources.length ? (
              <SourcesCard sources={message.sources} />
            ) : null}
            {message.gatekeeperPayload && isRecord(message.gatekeeperPayload) ? (
              <GatekeeperCard payload={message.gatekeeperPayload} />
            ) : null}
            {message.retrievePayload || message.retrieveError ? (
              <TopChunksCard payload={message.retrievePayload} error={message.retrieveError} />
            ) : null}
          </div>
        )}
      </div>
      {isUser ? (
        <AvatarBadge>U</AvatarBadge>
      ) : null}
    </div>
  );
});

const EmptyState = memo(function EmptyState() {
  return (
    <div className="mx-auto flex w-full max-w-xl flex-col items-center gap-3 px-6 py-14 text-center">
      <div className="relative">
        <div className="absolute -inset-10 rounded-full bg-[conic-gradient(from_220deg,rgba(0,110,255,0.22),rgba(255,135,0,0.18),rgba(0,110,255,0.22))] blur-2xl" />
        <Surface
          tone="glass"
          className="relative bg-white/70 px-5 py-4 text-sm text-zinc-900 shadow-sm dark:bg-white/5 dark:text-zinc-100"
        >
          Ask anything. This will retrieve Top Chunks and show them under the assistant response.
        </Surface>
      </div>
      <div className="flex flex-wrap justify-center gap-2 pt-2 text-xs text-zinc-600 dark:text-zinc-400">
        {INPUT_HINTS.map((hint) => (
          <Pill key={hint} tone="default" size="hint">
            &quot;{hint}&quot;
          </Pill>
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
      const payload = await callChat(text);
      const sources = normalizeSourceCitations(payload.sources);

      const gatekeeperPayload: GatekeeperApiResponse | null =
        payload.debug?.gatekeeper && isRecord(payload.debug.gatekeeper)
          ? {
              gatekeeper: payload.debug.gatekeeper as unknown as GatekeeperMetadata,
              rewritten_query: payload.debug.rewritten_query,
            }
          : null;
      const retrievePayload: RetrieveApiResponse | null =
        payload.debug?.retrieval && isRecord(payload.debug.retrieval)
          ? (payload.debug.retrieval as unknown as RetrieveApiResponse)
          : null;

      const assistantMsg: ChatMessage = {
        ...createMessage("assistant", payload.answer),
        sources,
        gatekeeperPayload,
        retrievePayload,
        retrieveError: null,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (e) {
      const msg =
        e instanceof Error ? e.message : "Unknown error calling /api/chat";
      const assistantMsg = createMessage(
        "assistant",
        `Chat error:\n${msg}`,
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
        "Cleared. Send a message to run /api/chat again.",
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
              Calls /api/chat (gatekeeper + retrieve + generate)
            </p>
          </div>
        </div>
        <GlassButton onClick={onClear} size="xs">
          Clear
        </GlassButton>
      </div>

      <div
        ref={scrollContainerRef}
        onScroll={onScroll}
        className="flex-1 overflow-y-auto px-5 py-6"
      >
        <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
          {messagesCount <= 1 ? <EmptyState /> : null}
          {hiddenMessagesCount > 0 && !showAllMessages ? (
            <GlassButton
              onClick={() => setShowAllMessages(true)}
              size="xs"
              className="mx-auto text-[11px]"
            >
              Show earlier messages ({hiddenMessagesCount} hidden)
            </GlassButton>
          ) : null}
          {displayedMessages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}
          {isSending ? (
            <div className="flex items-end gap-3">
              <AvatarBadge className="text-zinc-800 dark:text-zinc-200">R</AvatarBadge>
              <div className="ch26-surface bg-white/70 px-4 py-3 text-sm text-zinc-800 dark:bg-white/5 dark:text-zinc-200">
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
          <div className="group relative ch26-surface bg-white/70 shadow-sm transition focus-within:bg-white/80 focus-within:shadow-[0_16px_44px_-30px_rgba(0,0,0,0.55)] dark:bg-black/20 dark:focus-within:bg-black/25">
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
              <GlassButton
                onClick={onFocus}
                size="xs"
                className="hidden py-2 sm:inline-flex"
              >
                Focus
              </GlassButton>
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
