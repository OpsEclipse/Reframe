type OpenAIEmbeddingsRequest = {
  model: string;
  input: string | string[];
  encoding_format?: "float" | "base64";
  dimensions?: number;
  user?: string;
};

type OpenAIEmbeddingsResponse = {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
};

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getBaseUrl(): string {
  const raw = process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
  return raw.replace(/\/+$/, "");
}

export async function openaiEmbedText(input: string, opts?: { model?: string; dimensions?: number }) {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const baseUrl = getBaseUrl();
  const model = opts?.model || process.env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small";

  const body: OpenAIEmbeddingsRequest = {
    model,
    input,
    encoding_format: "float",
  };
  if (typeof opts?.dimensions === "number") body.dimensions = opts.dimensions;

  const res = await fetch(`${baseUrl}/embeddings`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  let json: OpenAIEmbeddingsResponse | null = null;
  try {
    json = JSON.parse(text) as OpenAIEmbeddingsResponse;
  } catch {
    // fall through
  }

  if (!res.ok) {
    const msg = json?.error?.message || text || `HTTP ${res.status}`;
    throw new Error(`OpenAI embeddings error: ${msg}`);
  }

  const embedding = json?.data?.[0]?.embedding;
  if (!Array.isArray(embedding) || embedding.length === 0) {
    throw new Error("OpenAI embeddings returned empty embedding");
  }

  return { model, embedding };
}

