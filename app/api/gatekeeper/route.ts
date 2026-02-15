import { gatekeepQuery } from "@/lib/gatekeeper";
import { openaiEmbedText } from "@/lib/openai-embeddings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GatekeeperRequest = {
  query: string;
  timezone?: string;
  embed?: boolean;
  include_embedding_vector?: boolean;
};

export async function POST(req: Request) {
  let body: GatekeeperRequest | null = null;
  try {
    body = (await req.json()) as GatekeeperRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = body?.query;
  if (typeof query !== "string" || !query.trim()) {
    return Response.json({ error: "`query` (string) is required" }, { status: 400 });
  }

  try {
    const meta = await gatekeepQuery({
      query,
      timezone: typeof body?.timezone === "string" ? body.timezone : undefined,
    });

    const embed = typeof body?.embed === "boolean" ? body.embed : true;
    if (!embed) return Response.json({ gatekeeper: meta }, { status: 200 });

    const rewritten_query = meta.reframed_query?.trim() ? meta.reframed_query.trim() : query.trim();
    const { model, embedding } = await openaiEmbedText(rewritten_query);
    const includeVector = body?.include_embedding_vector === true;

    return Response.json(
      {
        gatekeeper: meta,
        rewritten_query,
        embedding: includeVector ? { model, dims: embedding.length, vector: embedding } : { model, dims: embedding.length },
      },
      { status: 200 },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg }, { status: 500 });
  }
}
