import { fetchWithTimeout, isAbortError } from "@/lib/fetch-with-timeout";

type PineconeMetadata = Record<string, unknown>;

export type PineconeMatch = {
  id: string;
  score?: number;
  metadata?: PineconeMetadata;
};

type PineconeQueryRequest = {
  vector: number[];
  topK: number;
  includeMetadata?: boolean;
  includeValues?: boolean;
  namespace?: string;
  filter?: Record<string, unknown>;
};

type PineconeQueryResponse = {
  matches?: PineconeMatch[];
  namespace?: string;
  usage?: unknown;
  error?: { message?: string } | string;
};

function envTimeoutMs(name: string, def: number): number {
  const raw = process.env[name];
  if (!raw) return def;
  const n = Number(raw);
  if (!Number.isFinite(n)) return def;
  return Math.trunc(n);
}

function requiredEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

function getIndexHost(): string {
  const raw = requiredEnv("PINECONE_INDEX_HOST").trim();
  const host = raw.replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(host)) {
    throw new Error("PINECONE_INDEX_HOST must include scheme, e.g. https://your-index-host");
  }
  return host;
}

export async function pineconeQuery(opts: {
  vector: number[];
  topK: number;
  namespace?: string;
  filter?: Record<string, unknown>;
  includeMetadata?: boolean;
}): Promise<{ matches: PineconeMatch[] }> {
  const apiKey = requiredEnv("PINECONE_API_KEY");
  const host = getIndexHost();
  const timeoutMs = envTimeoutMs("PINECONE_TIMEOUT_MS", 12_000);

  const body: PineconeQueryRequest = {
    vector: opts.vector,
    topK: opts.topK,
    includeMetadata: opts.includeMetadata ?? true,
    includeValues: false,
  };
  if (typeof opts.namespace === "string" && opts.namespace.trim()) body.namespace = opts.namespace.trim();
  if (opts.filter && Object.keys(opts.filter).length) body.filter = opts.filter;

  let res: Response;
  try {
    res = await fetchWithTimeout(
      `${host}/query`,
      {
        method: "POST",
        headers: {
          "Api-Key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(body),
      },
      { timeoutMs },
    );
  } catch (e) {
    if (isAbortError(e)) throw new Error("Pinecone query timed out");
    throw e;
  }

  const text = await res.text();
  let json: PineconeQueryResponse | null = null;
  try {
    json = JSON.parse(text) as PineconeQueryResponse;
  } catch {
    // fall through
  }

  if (!res.ok) {
    const msg =
      (typeof json?.error === "string" && json.error) ||
      (typeof json?.error === "object" && json?.error?.message) ||
      text ||
      `HTTP ${res.status}`;
    throw new Error(`Pinecone query error: ${msg}`);
  }

  const matches = Array.isArray(json?.matches) ? json.matches.filter((m) => !!m && typeof m.id === "string") : [];
  return { matches };
}
