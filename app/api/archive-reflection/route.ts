import { buildTopChunksForPrompt } from "@/lib/chat-prompt";
import { groqChatCompletion } from "@/lib/groq-client";
import { openaiChatCompletion } from "@/lib/openai-client";
import { runRetrieval } from "@/lib/retrieve";
import { ArchiveReflectionSchema, sanitizeArchiveReflection } from "@/lib/archive-reflection";
import { isRateLimitMessage, retryAfterHeadersFromMessage } from "@/lib/rate-limit";
import { parseModelJsonObject } from "@/lib/model-json";

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
    "Return ONLY a single JSON object that matches the provided schema (no markdown, no prose outside JSON).",
    "All keys are required. Never omit keys. If unsure, use empty strings, empty arrays, or null (only where allowed).",
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
    "Template (copy this shape exactly; fill in values):",
    "{",
    '  "greeting": "greeting_name,",',
    '  "anchor_line": { "before": "", "highlight": "", "after": "." },',
    '  "lines": [],',
    '  "transition": "",',
    '  "timeline": [],',
    '  "conclusion": "",',
    '  "pattern": [],',
    '  "question": "",',
    '  "sources": []',
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

export async function POST(req: Request) {
  let body: RequestBody | null = null;
  try {
    body = (await req.json()) as RequestBody;
  } catch {
    // Body is optional; accept empty requests (e.g. submit({}) or fetch with no body).
    body = {};
  }

  const hasOpenAI = !!process.env.OPENAI_API_KEY;
  const hasGroq = !!process.env.GROQ_API_KEY;
  if (!hasOpenAI && !hasGroq) {
    return Response.json({ error: stableErrorMessage("misconfigured") }, { status: 500 });
  }

  const providerPrefRaw = (process.env.ARCHIVE_REFLECTION_PROVIDER || process.env.MAIN_LLM_PROVIDER || "")
    .trim()
    .toLowerCase();
  const providerPref: "auto" | "openai" | "groq" =
    providerPrefRaw === "openai" || providerPrefRaw === "groq" ? providerPrefRaw : "auto";

  const openaiModel =
    (process.env.ARCHIVE_REFLECTION_OPENAI_MODEL || "").trim() ||
    (process.env.MAIN_LLM_MODEL || "").trim() ||
    "gpt-4o-mini";
  const groqModel =
    (process.env.ARCHIVE_REFLECTION_GROQ_MODEL || "").trim() ||
    (process.env.ARCHIVE_REFLECTION_MODEL || "").trim() ||
    (process.env.MAIN_LLM_FALLBACK_MODEL || "").trim() ||
    (process.env.GROQ_MODEL || "").trim() ||
    "llama-3.3-70b-versatile";

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

  try {
    const runOnce = async (repairHint?: string): Promise<string> => {
      const baseMessages = [
        { role: "system" as const, content: system },
        { role: "user" as const, content: JSON.stringify(promptPayload) },
      ];
      const messages = repairHint
        ? [...baseMessages, { role: "user" as const, content: repairHint }]
        : baseMessages;

      const timeoutMs = 25_000;
      const maxTokens = 1300;

      // Prefer JSON mode; retry without it if the model/provider rejects response_format.
      let lastErr: unknown = null;

      const tryOpenAI = async (): Promise<string> => {
        try {
          const { content } = await openaiChatCompletion(
            { model: openaiModel, temperature: 0, max_tokens: maxTokens, messages, response_format: { type: "json_object" } },
            { purpose: "archive_reflection", requestId: undefined, timeoutMs, maxRetries: 0 },
          );
          return content;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (msg.toLowerCase().includes("response_format") || msg.toLowerCase().includes("json_object")) {
            const { content } = await openaiChatCompletion(
              { model: openaiModel, temperature: 0, max_tokens: maxTokens, messages },
              { purpose: "archive_reflection", requestId: undefined, timeoutMs, maxRetries: 0 },
            );
            return content;
          }
          throw e;
        }
      };

      const tryGroq = async (): Promise<string> => {
        try {
          const { content } = await groqChatCompletion(
            { model: groqModel, temperature: 0, max_tokens: maxTokens, messages, response_format: { type: "json_object" } },
            { purpose: "archive_reflection", requestId: undefined, timeoutMs, maxRetries: 0 },
          );
          return content;
        } catch (e) {
          const msg = e instanceof Error ? e.message : "";
          if (msg.toLowerCase().includes("response_format") || msg.toLowerCase().includes("json_object")) {
            const { content } = await groqChatCompletion(
              { model: groqModel, temperature: 0, max_tokens: maxTokens, messages },
              { purpose: "archive_reflection", requestId: undefined, timeoutMs, maxRetries: 0 },
            );
            return content;
          }
          throw e;
        }
      };

      if (hasOpenAI && providerPref !== "groq") {
        try {
          return await tryOpenAI();
        } catch (e) {
          lastErr = e;
        }
      }

      if (hasGroq && providerPref !== "openai") {
        try {
          return await tryGroq();
        } catch (e) {
          lastErr = e;
        }
      }

      throw lastErr instanceof Error ? lastErr : new Error("LLM generation failed");
    };

    const text = await runOnce();

	    let parsed: unknown;
	    try {
	      parsed = parseModelJsonObject(text);
	    } catch (e) {
	      const msg = e instanceof Error ? e.message : "Invalid JSON";
	      // One repair retry: ask the model to re-emit valid JSON only.
	      const hint =
	        "Your previous response was invalid JSON (" +
	        msg +
	        "). Output ONLY corrected JSON that matches the schema. Use double quotes, no trailing commas.";
	      const repairedText = await runOnce(hint);
	      parsed = parseModelJsonObject(repairedText);
	    }

	    let validated = ArchiveReflectionSchema.safeParse(parsed);
	    if (!validated.success) {
	      const flat = validated.error.flatten();
	      const missingKeys = Object.keys(flat.fieldErrors || {}).filter(Boolean);
	      const hint = [
	        "Your previous JSON did not match the schema (missing/invalid fields: " +
	          (missingKeys.length ? missingKeys.join(", ") : "unknown") +
	          ").",
	        "Output ONLY corrected JSON with ALL required keys present (copy the template from the system prompt).",
	        "For any string field you are unsure about, output an empty string. For arrays, output [].",
	        "Validation errors (for reference): " + JSON.stringify(flat),
	      ].join("\n");
	      const repairedText = await runOnce(hint);
	      parsed = parseModelJsonObject(repairedText);
	      validated = ArchiveReflectionSchema.safeParse(parsed);
	    }

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
