export type GroqChatMessage = {
  role: "system" | "user" | "assistant";
  content: string;
};

type GroqChatCompletionRequest = {
  model: string;
  messages: GroqChatMessage[];
  temperature?: number;
  max_tokens?: number;
  // Groq is OpenAI-compatible; JSON mode support depends on model.
  response_format?: { type: "json_object" } | { type: string };
};

type GroqChatCompletionResponse = {
  choices?: Array<{
    message?: { content?: string | null };
  }>;
  error?: { message?: string };
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getBaseUrl(): string {
  const raw = process.env.GROQ_BASE_URL || "https://api.groq.com/openai/v1";
  return raw.replace(/\/+$/, "");
}

export async function groqChatCompletion(
  req: GroqChatCompletionRequest,
): Promise<{ content: string; rawText: string }> {
  const apiKey = requiredEnv("GROQ_API_KEY");
  const baseUrl = getBaseUrl();

  const res = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(req),
  });

  const rawText = await res.text();
  let json: GroqChatCompletionResponse | null = null;
  try {
    json = JSON.parse(rawText) as GroqChatCompletionResponse;
  } catch {
    // fall through
  }

  if (!res.ok) {
    const msg = json?.error?.message || rawText || `HTTP ${res.status}`;
    throw new Error(`Groq API error: ${msg}`);
  }

  const content = json?.choices?.[0]?.message?.content ?? null;
  if (!content) throw new Error("Groq API returned empty completion content");
  return { content, rawText };
}

