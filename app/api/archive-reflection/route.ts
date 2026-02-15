import { buildTopChunksForPrompt } from "@/lib/chat-prompt";
import { runRetrieval } from "@/lib/retrieve";
import { ArchiveReflectionSchema, sanitizeArchiveReflection } from "@/lib/archive-reflection";
import { isRateLimitMessage, retryAfterHeadersFromMessage } from "@/lib/rate-limit";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Allow long-running LLM + retrieval responses up to 60s.
export const maxDuration = 60;

type RequestBody = {
  // Optional; improves "today/yesterday" handling in gatekeeper (mirrors /api/chat contract).
  timezone?: string;
  // Optional; lets the client override greeting personalization later.
  name?: string;
};

function stableErrorMessage(kind: "bad_request" | "misconfigured" | "retrieval" | "llm"): string {
  if (kind === "bad_request") return "Invalid request.";
  if (kind === "misconfigured") return "Server misconfigured.";
  if (kind === "retrieval") return "Retrieval failed.";
  return "LLM generation failed.";
}

function pickRandom<T>(arr: readonly T[]): T {
  // Server-side randomness is fine for now (no determinism requirement yet).
  return arr[Math.floor(Math.random() * arr.length)]!;
}

function buildArchiveReflectionSystemPrompt(validChunkIds: string[]): string {
  return [
    "You are generating a short reflection block with a timeline of evidence from the user's archive.",
    "Return only JSON that matches the provided schema (no markdown, no prose outside JSON).",
    "",
    "JSON schema (shape + types):",
    "{",
    '  "greeting": string,',
    '  "anchor_line": { "before": string, "highlight": string, "after": string },',
    '  "lines": string[],',
    '  "transition": string,',
    '  "timeline": Array<{ "periodLabel": string, "entriesCountLabel": string, "content": string, "source_id": string|null, "reframe": string|null }>,',
    '  "conclusion": string,',
    '  "pattern": string[],',
    '  "question": string,',
    '  "sources": Array<{ "id": string, "title": string|null, "source": string|null, "score": number|null, "preview": string|null }>',
    "}",
    "",
    "Voice & POV:",
    "- Write as a human narrator talking TO the greeting_name in SECOND PERSON.",
    "- Use \"you\" and \"your\" (e.g. \"You thought you were stuck...\", \"Your reflections...\").",
    "- Do NOT write in first person (avoid: I, I've, me, my, mine, we, our).",
    "- Avoid referring to the user in third person (avoid: Raghav/he/she/they) except for the greeting line which is always \"greeting_name,\".",
    "",
    "Grounding:",
    "- You will be given retrieved_chunks (id + metadata).",
    "- Any timeline[*].source_id must be one of the provided chunk ids, or null if truly none.",
    "- Never invent sources or ids. If uncertain, set source_id to null.",
    "",
    "Cadence constraints (match the UI):",
    "- Keep lines short and punchy. Avoid long paragraphs.",
    "- `lines`: 2-6 items max; each is a single sentence or fragment.",
    "- `timeline`: 0-8 items. Each `content` should be 1-2 sentences.",
    "- `conclusion`: allow a line break (\"\\n\") for a 2-line ending.",
    "- `pattern`: 0-4 items; each should be short.",
    "- `greeting`: should be the greeting_name followed by a comma (e.g. \"Raghav,\").",
    "- `timeline[*].periodLabel`: prefer uppercase like \"IN APRIL 2025\".",
    "- `timeline[*].entriesCountLabel`: short count like \"3+\" (do not include the word ENTRIES).",
    "",
    "Additional rules:",
    `- The allowed chunk ids are: ${validChunkIds.length ? validChunkIds.join(", ") : "(none)"}.`,
    "- `sources` must be 0-8 items and must reference ONLY allowed chunk ids.",
    "- `sources` should correspond to the unique set of non-null timeline[*].source_id values (same ids).",
    "- For each item in `sources`, copy `title`/`source`/`score`/`preview` from the matching retrieved_chunks item. Do not invent or edit these fields.",
    "- Prefer small source sets (0-6). Deduplicate by id.",
    "- Set timeline[*].reframe to null (no direct quoting UI yet).",
  ].join("\n");
}

function stripCodeFences(text: string): string {
  // Some models occasionally wrap JSON in ```json fences despite instructions.
  return text.replace(/^```[a-zA-Z]*\n?/, "").replace(/\n?```$/, "").trim();
}

function parseModelJson(text: string): unknown {
  const cleaned = stripCodeFences(text).trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    const first = cleaned.indexOf("{");
    const last = cleaned.lastIndexOf("}");
    if (first !== -1 && last !== -1 && last > first) {
      return JSON.parse(cleaned.slice(first, last + 1));
    }
    throw new Error("Model did not return JSON.");
  }
}

export async function POST(req: Request) {
  let body: RequestBody | null = null;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    // Body is optional; accept empty requests (e.g. submit({}) or fetch with no body).
    body = {};
  }

  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return Response.json({ error: stableErrorMessage("misconfigured") }, { status: 500 });
  }

  const modelName = process.env.MAIN_LLM_MODEL || "llama-3.3-70b-versatile";

  const seedPrompts = [
    "Write a reflection that highlights how you've changed over the last year, with evidence from your entries.",
    "Find a pattern in how you respond to pressure over time, grounded in your archive.",
    "Show where you thought you were stuck, but the archive shows movement.",
    "Surface a quiet win you underestimated, and show its trail across your entries.",
    "Compare what you feared a year ago with what you actually did, using specific entry evidence.",
  ] as const;

  const seed = pickRandom(seedPrompts);
  const query = seed;
  const topK = 12;

  // Step 1: retrieval
  // This endpoint uses fixed seed prompts (not user-entered queries), so a Gatekeeper LLM call adds cost
  // without much benefit. Provide empty facets and let retrieval proceed directly.
  let retrieval;
  try {
    retrieval = await runRetrieval({
      query,
      gatekeeper: {
        skip_RAG: false,
        reframed_query: null,
        emotions: null,
        people: null,
        keywords: null,
        date_int: null,
      },
      top_k: topK,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    console.error("[api/archive-reflection] retrieval error:", msg);
    return Response.json({ error: stableErrorMessage("retrieval") }, { status: 502 });
  }

  // Step 2: prompt context
  const promptChunks = buildTopChunksForPrompt(retrieval.chunks ?? [], topK);
  const validChunkIds = promptChunks.map((c) => c.id);
  const system = buildArchiveReflectionSystemPrompt(validChunkIds);

  const greetingName = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : "Raghav";

  const promptPayload = {
    greeting_name: greetingName,
    reflection_seed: seed,
    original_query: query,
    rewritten_query: retrieval.rewritten_query ?? query,
    retrieved_chunks: promptChunks,
  };

  // Step 3: Use Vercel AI SDK streaming for structured object generation (compatible with experimental_useObject).
  const groqOpenAI = createOpenAI({
    name: "groq",
    apiKey,
    baseURL: process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1",
  });

  try {
    // Use plain text generation and parse JSON ourselves.
    // This avoids Groq models that do not support `response_format: { type: "json_schema" }`.
    const result = await generateText({
      // Groq is OpenAI-compatible; treat it as an OpenAI chat model.
      model: groqOpenAI.chat(modelName as never),
      temperature: 0,
      maxOutputTokens: 1300,
      messages: [
        { role: "system", content: system },
        { role: "user", content: JSON.stringify(promptPayload) },
      ],
    });

    const parsed = parseModelJson(result.text);
    const validated = ArchiveReflectionSchema.safeParse(parsed);
    if (!validated.success) {
      console.error("[api/archive-reflection] invalid model JSON:", validated.error.flatten());
      return Response.json({ error: stableErrorMessage("llm") }, { status: 502 });
    }

    const sanitized = sanitizeArchiveReflection(validated.data, { validSourceIds: validChunkIds });
    return Response.json(sanitized);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "";
    if (isRateLimitMessage(msg)) {
      return Response.json(
        { error: "Rate limited. Please retry shortly." },
        {
          status: 429,
          headers: retryAfterHeadersFromMessage(msg),
        },
      );
    }
    console.error("[api/archive-reflection] LLM request error:", msg);
    return Response.json({ error: stableErrorMessage("llm") }, { status: 502 });
  }
}
