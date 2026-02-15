import { gatekeepQuery } from "@/lib/gatekeeper";
import { buildMainChatSystemPrompt, buildTopChunksForPrompt } from "@/lib/chat-prompt";
import { groqChatCompletion } from "@/lib/groq-client";
import { HttpError } from "@/lib/http-error";
import { logEvent } from "@/lib/log";
import { openaiChatCompletion } from "@/lib/openai-client";
import { getOrCreateRequestId } from "@/lib/request-id";
import { envInt } from "@/lib/retry";
import { parseChatGenerateModelOutput, type ChatGenerateRequest, type ChatGenerateResponse, type SourceCitation } from "@/lib/rag-answer";
import { runRetrieval } from "@/lib/retrieve";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type ChatRequest = ChatGenerateRequest & {
  // Optional; improves interpretation of "today/yesterday/tomorrow" in gatekeeper.
  timezone?: string;
};

function isRecord(x: unknown): x is Record<string, unknown> {
  return !!x && typeof x === "object" && !Array.isArray(x);
}

function dedupeById<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const it of items) {
    if (!it?.id) continue;
    if (seen.has(it.id)) continue;
    seen.add(it.id);
    out.push(it);
  }
  return out;
}

function stableErrorMessage(kind: "retrieval" | "llm" | "bad_request"): string {
  if (kind === "bad_request") return "Invalid request.";
  if (kind === "retrieval") return "Retrieval failed.";
  return "LLM generation failed.";
}

function responseForUpstreamError(e: unknown, kind: "retrieval" | "llm", requestId: string) {
  if (e instanceof HttpError && e.status === 429) {
    const headers = new Headers();
    if (typeof e.retryAfterMs === "number") headers.set("Retry-After", String(Math.ceil(e.retryAfterMs / 1000)));
    headers.set("X-Request-Id", requestId);
    return Response.json({ error: "Rate limited.", provider: e.provider, requestId }, { status: 429, headers });
  }
  return Response.json({ error: stableErrorMessage(kind), requestId }, { status: 502, headers: { "X-Request-Id": requestId } });
}

export async function POST(req: Request) {
  const requestId = getOrCreateRequestId(req);
  const t0 = Date.now();
  let body: ChatRequest | null = null;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return Response.json(
      { error: stableErrorMessage("bad_request"), requestId },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }

  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) {
    return Response.json(
      { error: "`query` (string) is required", requestId },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }

  // Per contract: the main LLM is always fed up to the top 12 chunks.
  // If retrieval finds fewer, we pass fewer.
  const topK = 12;
  const includeDebug = process.env.CHAT_DEBUG === "1";
  logEvent("info", "chat.start", {
    requestId,
    queryLen: query.length,
    timezone: typeof body?.timezone === "string" ? body.timezone : undefined,
    includeDebug,
    topK,
  });

  // Step 1: gatekeeper
  const tGateStart = Date.now();
  let gatekeeperMeta: Awaited<ReturnType<typeof gatekeepQuery>>;
  try {
    gatekeeperMeta = await gatekeepQuery({
      query,
      timezone: typeof body?.timezone === "string" ? body.timezone : undefined,
      requestId,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/chat] gatekeeper error:", msg);
    logEvent("error", "chat.gatekeeper_error", { requestId, error: msg });
    return responseForUpstreamError(e, "llm", requestId);
  }
  const gatekeeperMs = Date.now() - tGateStart;

  // Step 2: retrieval (hard-capped/clamped to 12)
  const tRetStart = Date.now();
  let retrieval;
  try {
    retrieval = await runRetrieval({
      query,
      gatekeeper: gatekeeperMeta,
      top_k: topK,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/chat] retrieval error:", msg);
    logEvent("error", "chat.retrieval_error", { requestId, error: msg });
    return responseForUpstreamError(e, "retrieval", requestId);
  }
  const retrievalMs = Date.now() - tRetStart;

  // Step 3: prompt context
  const promptChunks = buildTopChunksForPrompt(retrieval.chunks ?? [], topK);
  const promptPayload = {
    original_query: query,
    rewritten_query: retrieval.rewritten_query ?? query,
    retrieved_chunks: promptChunks,
  };
  const promptPayloadJson = JSON.stringify(promptPayload);
  const promptBytes = promptPayloadJson.length;

  // Step 4: main LLM
  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;
  if (!hasOpenAI && !hasGroq) {
    return Response.json(
      { error: "Missing required env var: OPENAI_API_KEY (preferred) or GROQ_API_KEY (fallback)", requestId },
      { status: 500, headers: { "X-Request-Id": requestId } },
    );
  }

  const model = (process.env.MAIN_LLM_MODEL || "").trim() || "gpt-4o";
  const fallbackModel = (process.env.MAIN_LLM_FALLBACK_MODEL || "").trim() || "llama-3.3-70b-versatile";
  const system = buildMainChatSystemPrompt();

  const baseReq = {
    temperature: 0,
    max_tokens: 1024,
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: promptPayloadJson },
    ],
  };

  let completion: { content: string } | null = null;
  let lastErr: unknown = null;
  let usedProvider: "openai" | "groq" | null = null;

  const openAiRouteRetries = Math.max(0, envInt("MAIN_LLM_OPENAI_ROUTE_MAX_RETRIES", 1));
  const tLlmStart = Date.now();

  if (hasOpenAI) {
    try {
      completion = await openaiChatCompletion(
        { ...baseReq, model, response_format: { type: "json_object" } },
        { maxRetries: openAiRouteRetries, requestId, purpose: "chat_main" },
      );
      usedProvider = "openai";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      // If the provider/model rejects response_format, retry without it (prompt still enforces JSON-only).
      if (msg.toLowerCase().includes("response_format") || msg.toLowerCase().includes("json_object")) {
        try {
          completion = await openaiChatCompletion(
            { ...baseReq, model },
            { maxRetries: openAiRouteRetries, requestId, purpose: "chat_main" },
          );
          usedProvider = "openai";
        } catch (e2) {
          lastErr = e2;
        }
      } else {
        lastErr = e;
      }
    }
  }

  if (!completion && hasGroq) {
    if (hasOpenAI && lastErr) {
      logEvent("warn", "chat.fallback", {
        requestId,
        from: "openai",
        to: "groq",
        primaryModel: model,
        fallbackModel,
        error: lastErr instanceof Error ? lastErr.message : String(lastErr),
      });
    }
    try {
      completion = await groqChatCompletion(
        { ...baseReq, model: fallbackModel, response_format: { type: "json_object" } },
        { requestId, purpose: "chat_main_fallback" },
      );
      usedProvider = "groq";
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (msg.toLowerCase().includes("response_format") || msg.toLowerCase().includes("json_object")) {
        try {
          completion = await groqChatCompletion(
            { ...baseReq, model: fallbackModel },
            { requestId, purpose: "chat_main_fallback" },
          );
          usedProvider = "groq";
        } catch (e2) {
          lastErr = e2;
        }
      } else {
        lastErr = e;
      }
    }
  }
  const llmMs = Date.now() - tLlmStart;

  if (!completion) {
    const msg = lastErr instanceof Error ? lastErr.message : "Unknown error";
    console.error("[api/chat] LLM request error:", msg);
    logEvent("error", "chat.llm_error", { requestId, error: msg });
    return responseForUpstreamError(lastErr, "llm", requestId);
  }

  // Step 5: strict JSON parse (with a safety-net extractor)
  const tParseStart = Date.now();
  let parsed: { answer: string; sources: SourceCitation[] };
  try {
    parsed = parseChatGenerateModelOutput(completion.content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown parse error";
    console.error("[api/chat] LLM JSON parse failed:", msg);
    logEvent("error", "chat.parse_error", { requestId, error: msg, usedProvider, model, fallbackModel });
    return Response.json(
      { error: "LLM output JSON parse failed", detail: msg, requestId },
      { status: 502, headers: { "X-Request-Id": requestId } },
    );
  }
  const parseMs = Date.now() - tParseStart;

  const chunkById = new Map(promptChunks.map((c) => [c.id, c]));
  const mappedSources = dedupeById(parsed.sources)
    .map((s) => {
      const c = chunkById.get(s.id);
      if (!c) return null;
      return {
        id: s.id,
        title: s.title ?? c.title ?? null,
        source: s.source ?? c.source ?? c.file ?? c.path ?? c.url ?? null,
        score: s.score ?? (typeof c.score === "number" ? c.score : null),
        preview: s.preview ?? c.preview ?? null,
        metadata: isRecord(s.metadata) ? s.metadata : c.metadata,
      } satisfies SourceCitation;
    })
    .filter(Boolean) as SourceCitation[];

  const answer = typeof parsed.answer === "string" && parsed.answer.trim() ? parsed.answer.trim() : "I don't know.";

  const response: ChatGenerateResponse = {
    answer,
    sources: mappedSources,
    debug: includeDebug
      ? {
          rewritten_query: retrieval.rewritten_query ?? undefined,
          gatekeeper: gatekeeperMeta,
          retrieval: {
            rewritten_query: retrieval.rewritten_query,
            stats: retrieval.stats as unknown as Record<string, unknown>,
            chunks: retrieval.chunks as unknown as Array<Record<string, unknown>>,
          },
        }
      : undefined,
  };

  const totalMs = Date.now() - t0;
  logEvent("info", "chat.complete", {
    requestId,
    usedProvider,
    model,
    fallbackModel,
    gatekeeperMs,
    retrievalMs,
    llmMs,
    parseMs,
    totalMs,
    retrievedChunks: promptChunks.length,
    promptBytes,
  });

  return Response.json(response, { status: 200, headers: { "X-Request-Id": requestId } });
}
