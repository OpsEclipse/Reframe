import type { GatekeeperMetadata } from "@/lib/gatekeeper";
import { runRetrieval } from "@/lib/retrieve";
import { getOrCreateRequestId } from "@/lib/request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RetrieveRequest = {
  query: string;
  gatekeeper: Pick<GatekeeperMetadata, "reframed_query" | "emotions" | "people" | "keywords" | "date_int">;
  queryEmbedding?: number[];
  top_k?: number;
  base_top_k?: number;
  matched_top_k?: number;
  blend_ratio?: number;
  namespace?: string;
};

export async function POST(req: Request) {
  const requestId = getOrCreateRequestId(req);
  let body: RetrieveRequest | null = null;
  try {
    body = (await req.json()) as RetrieveRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body", requestId }, { status: 400, headers: { "X-Request-Id": requestId } });
  }

  const query = typeof body?.query === "string" ? body.query.trim() : "";
  if (!query) return Response.json({ error: "`query` (string) is required", requestId }, { status: 400, headers: { "X-Request-Id": requestId } });

  const gatekeeper = body?.gatekeeper;
  if (!gatekeeper || typeof gatekeeper !== "object") {
    return Response.json({ error: "`gatekeeper` object is required", requestId }, { status: 400, headers: { "X-Request-Id": requestId } });
  }

  // If the caller sends a massive queryEmbedding, reject before scanning/using it.
  const qe = (body as RetrieveRequest | null)?.queryEmbedding;
  if (Array.isArray(qe) && qe.length > 4096) {
    return Response.json(
      { error: "`queryEmbedding` exceeds max dims (4096)", requestId },
      { status: 400, headers: { "X-Request-Id": requestId } },
    );
  }

  try {
    const out = await runRetrieval({
      query,
      gatekeeper: gatekeeper as RetrieveRequest["gatekeeper"],
      requestId,
      queryEmbedding: body?.queryEmbedding,
      top_k: body?.top_k,
      base_top_k: body?.base_top_k,
      matched_top_k: body?.matched_top_k,
      blend_ratio: body?.blend_ratio,
      namespace: body?.namespace,
    });
    return Response.json(
      out,
      { status: 200, headers: { "X-Request-Id": requestId } },
    );
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg, requestId }, { status: 500, headers: { "X-Request-Id": requestId } });
  }
}
