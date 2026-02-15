This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Gatekeeper (OpenAI, Groq Fallback) API

This repo includes a backend route that uses **OpenAI** (default model: `gpt-4o-mini`) to extract nullable metadata from a query, then embeds the rewritten query using OpenAI embeddings (`text-embedding-3-*`). If OpenAI is unavailable/erroring and `GROQ_API_KEY` is set, it will fall back to Groq for the Gatekeeper call.

- Endpoint: `POST /api/gatekeeper`
- Body: `{ "query": string, "timezone"?: string, "embed"?: boolean, "include_embedding_vector"?: boolean }`
- Response (default): `{ "gatekeeper": { reframed_query, emotions, people, keywords, date_int }, "rewritten_query": string, "embedding": { "model": string, "dims": number } }`
- Response (`include_embedding_vector=true`): `{ "gatekeeper": { ... }, "rewritten_query": string, "embedding": { "model": string, "dims": number, "vector": number[] } }`
- Response (`embed=false`): `{ "gatekeeper": { ... } }`

## Chat (RAG-to-LLM) API

Single orchestration route that runs:

1. Gatekeeper (metadata + rewritten query decision)
2. Retrieval (top 12 chunks)
3. Main LLM generation (JSON-only output)

- Endpoint: `POST /api/chat`
- Body: `{ "query": string, "top_k"?: number, "timezone"?: string }`
  - `top_k` is accepted but the pipeline always retrieves/uses up to the top `12` chunks
- Response:
  - `answer: string`
  - `sources: Array<{ id: string, title?: string|null, source?: string|null, score: number|null, preview?: string|null, metadata?: Record<string, unknown> }>`
  - `debug?: { gatekeeper, rewritten_query, retrieval }` (only when `CHAT_DEBUG=1`)

Example response:

```json
{
  "answer": "…",
  "sources": [
    { "id": "chunk_123", "title": "…", "source": "…", "score": 0.92, "preview": "…" }
  ]
}
```

Env vars (see `.env.example`):

- `LOG_LLM` (optional, set to `1` to log LLM pipeline timings, retries, fallbacks, caching; also enabled when `CHAT_DEBUG=1`)
- `OPENAI_API_KEY` (required for gatekeeper + embeddings when `embed` is true; preferred provider)
- `OPENAI_MAX_RETRIES` (optional, defaults to `2`; retries 429/5xx with backoff)
- `OPENAI_MAX_CONCURRENCY` (optional, defaults to `4`; limits concurrent OpenAI requests per node process)
- `OPENAI_MIN_INTERVAL_MS` (optional, defaults to `0`; enforces minimum spacing between OpenAI requests per node process)
- `GATEKEEPER_MODEL` (optional, defaults to `gpt-4o-mini`)
- `GATEKEEPER_FALLBACK_MODEL` (optional, defaults to `GROQ_MODEL` or `llama3-8b-8192`)
- `GATEKEEPER_CACHE_TTL_MS` (optional, defaults to `60000`; set `0` to disable)
- `GROQ_API_KEY` (optional; used as fallback for both Gatekeeper and `/api/chat` main LLM generation when set)
- `GROQ_MAX_RETRIES` (optional, defaults to `2`; retries 429/5xx with backoff)
- `GROQ_MAX_CONCURRENCY` (optional, defaults to `4`; limits concurrent Groq requests per node process)
- `GROQ_MIN_INTERVAL_MS` (optional, defaults to `0`; enforces minimum spacing between Groq requests per node process)
- `MAIN_LLM_PROVIDER` (optional, `auto` | `openai` | `groq`; defaults to `auto` which tries OpenAI first when `OPENAI_API_KEY` is set, then falls back to Groq when `GROQ_API_KEY` is set)
- `MAIN_LLM_MODEL` (optional, defaults to `gpt-4o` on OpenAI)
- `MAIN_LLM_FALLBACK_MODEL` (optional, model name used when routing to Groq; defaults to `GROQ_MODEL` or `llama-3.3-70b-versatile`)
- `ARCHIVE_REFLECTION_MODEL` (optional, model name used by `/api/archive-reflection` when routing to Groq; defaults to `MAIN_LLM_FALLBACK_MODEL`, `GROQ_MODEL`, or `llama-3.3-70b-versatile`)
- `MAIN_LLM_OPENAI_ROUTE_MAX_RETRIES` (optional, defaults to `1`; OpenAI retries in `/api/chat` before falling back to Groq)
- `CHAT_DEBUG` (optional, set to `1` to include `debug` fields in `/api/chat` responses)
- `GROQ_BASE_URL` (optional, defaults to `https://api.groq.com/openai/v1`)
- `GROQ_TIMEOUT_MS` (optional, defaults to `20000`)
- `OPENAI_EMBEDDING_MODEL` (optional, defaults to `text-embedding-3-small`)
- `OPENAI_EMBED_CACHE_TTL_MS` (optional, defaults to `300000`; set `0` to disable)
- `OPENAI_BASE_URL` (optional, defaults to `https://api.openai.com/v1`)
- `OPENAI_TIMEOUT_MS` (optional, defaults to `20000`)
- `PINECONE_API_KEY` (required for retrieval)
- `PINECONE_INDEX_HOST` (required for retrieval)
- `PINECONE_NAMESPACE` (optional)
- `PINECONE_TIMEOUT_MS` (optional, defaults to `12000`)

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
