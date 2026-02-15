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

## Gatekeeper (Groq) API

This repo includes a backend route that uses Groq to extract nullable metadata from a query, then embeds the rewritten query using OpenAI (`text-embedding-3-*`).

- Endpoint: `POST /api/gatekeeper`
- Body: `{ "query": string, "timezone"?: string, "embed"?: boolean, "include_embedding_vector"?: boolean }`
- Response (default): `{ "gatekeeper": { reframed_query, emotions, people, keywords, date_int }, "rewritten_query": string, "embedding": { "model": string, "dims": number } }`
- Response (`include_embedding_vector=true`): `{ "gatekeeper": { ... }, "rewritten_query": string, "embedding": { "model": string, "dims": number, "vector": number[] } }`
- Response (`embed=false`): `{ "gatekeeper": { ... } }`

Env vars (see `.env.example`):

- `GROQ_API_KEY` (required)
- `GATEKEEPER_MODEL` (optional, defaults to `llama3-8b-8192`; can also use `GROQ_MODEL`)
- `GROQ_BASE_URL` (optional, defaults to `https://api.groq.com/openai/v1`)
- `GROQ_TIMEOUT_MS` (optional, defaults to `20000`)
- `OPENAI_API_KEY` (required if `embed` is true)
- `OPENAI_EMBEDDING_MODEL` (optional, defaults to `text-embedding-3-small`)
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
