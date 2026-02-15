import { gatekeepQuery } from "@/lib/gatekeeper";
import { buildMainChatSystemPrompt, buildTopChunksForPrompt } from "@/lib/chat-prompt";
import { groqChatCompletion } from "@/lib/groq-client";
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

export async function POST(req: Request) {
  let body: ChatRequest | null = null;
  try {
    body = (await req.json()) as ChatRequest;
  } catch {
    return Response.json({ error: stableErrorMessage("bad_request") }, { status: 400 });
  }

  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) {
    return Response.json({ error: "`query` (string) is required" }, { status: 400 });
  }

  // Per contract: the main LLM is always fed up to the top 12 chunks.
  // If retrieval finds fewer, we pass fewer.
  const topK = 12;
  const includeDebug = process.env.CHAT_DEBUG === "1";

  // Step 1: gatekeeper
  let gatekeeperMeta: Awaited<ReturnType<typeof gatekeepQuery>>;
  try {
    gatekeeperMeta = await gatekeepQuery({
      query,
      timezone: typeof body?.timezone === "string" ? body.timezone : undefined,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/chat] gatekeeper error:", msg);
    return Response.json({ error: stableErrorMessage("llm") }, { status: 502 });
  }

  // Step 2: retrieval (hard-capped/clamped to 12)
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
    return Response.json({ error: stableErrorMessage("retrieval") }, { status: 502 });
  }

  // Step 3: prompt context
  const promptChunks = buildTopChunksForPrompt(retrieval.chunks ?? [], topK);
  const promptPayload = {
    original_query: query,
    rewritten_query: retrieval.rewritten_query ?? query,
    retrieved_chunks: promptChunks,
  };

  // Step 4: main LLM
  const model = process.env.MAIN_LLM_MODEL || "llama-3.3-70b-versatile";
  const system = buildMainChatSystemPrompt();

  const baseReq = {
    model,
    temperature: 0,
    max_tokens: 1024,
    messages: [
      { role: "system" as const, content: system },
      { role: "user" as const, content: JSON.stringify(promptPayload) },
    ],
  };

  let completion: { content: string } | null = null;
  try {
    completion = await groqChatCompletion({ ...baseReq, response_format: { type: "json_object" } });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    // If the provider/model rejects response_format, retry without it (prompt still enforces JSON-only).
    if (msg.toLowerCase().includes("response_format") || msg.toLowerCase().includes("json_object")) {
      completion = await groqChatCompletion(baseReq);
    } else {
      console.error("[api/chat] LLM request error:", msg);
      return Response.json({ error: stableErrorMessage("llm") }, { status: 502 });
    }
  }

  // Step 5: strict JSON parse (with a safety-net extractor)
  let parsed: { answer: string; sources: SourceCitation[] };
  try {
    parsed = parseChatGenerateModelOutput(completion.content);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown parse error";
    console.error("[api/chat] LLM JSON parse failed:", msg);
    return Response.json({ error: "LLM output JSON parse failed", detail: msg }, { status: 502 });
  }

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

  return Response.json(response, { status: 200 });
}
