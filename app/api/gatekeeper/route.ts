import { gatekeepQuery } from "@/lib/gatekeeper";
import { HttpError } from "@/lib/http-error";
import { logEvent } from "@/lib/log";
import { openaiEmbedText } from "@/lib/openai-embeddings";
import { getOrCreateRequestId } from "@/lib/request-id";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type GatekeeperRequest = {
  query: string;
  timezone?: string;
  embed?: boolean;
  include_embedding_vector?: boolean;
};

export async function POST(req: Request) {
  const requestId = getOrCreateRequestId(req);
  let body: GatekeeperRequest | null = null;
  try {
    body = (await req.json()) as GatekeeperRequest;
  } catch {
    return Response.json({ error: "Invalid JSON body", requestId }, { status: 400, headers: { "X-Request-Id": requestId } });
  }

  const query = body?.query;
  if (typeof query !== "string" || !query.trim()) {
    return Response.json({ error: "`query` (string) is required", requestId }, { status: 400, headers: { "X-Request-Id": requestId } });
  }

  try {
    const t0 = Date.now();
    const embed = typeof body?.embed === "boolean" ? body.embed : true;
    logEvent("info", "gatekeeper_api.start", {
      requestId,
      queryLen: query.trim().length,
      timezone: typeof body?.timezone === "string" ? body.timezone : undefined,
      embed,
    });

    const meta = await gatekeepQuery({
      query,
      timezone: typeof body?.timezone === "string" ? body.timezone : undefined,
      requestId,
    });

    if (!embed) {
      logEvent("info", "gatekeeper_api.complete", { requestId, totalMs: Date.now() - t0, embedded: false });
      return Response.json({ gatekeeper: meta }, { status: 200, headers: { "X-Request-Id": requestId } });
    }

    const rewritten_query = meta.reframed_query?.trim() ? meta.reframed_query.trim() : query.trim();
    const { model, embedding } = await openaiEmbedText(rewritten_query, { requestId, purpose: "gatekeeper_embed" });
    const includeVector = body?.include_embedding_vector === true;

    logEvent("info", "gatekeeper_api.complete", {
      requestId,
      totalMs: Date.now() - t0,
      embedded: true,
      embeddingModel: model,
      embeddingDims: embedding.length,
    });

    return Response.json(
      {
        gatekeeper: meta,
        rewritten_query,
        embedding: includeVector ? { model, dims: embedding.length, vector: embedding } : { model, dims: embedding.length },
      },
      { status: 200, headers: { "X-Request-Id": requestId } },
    );
  } catch (e) {
    if (e instanceof HttpError) {
      logEvent(e.status === 429 ? "warn" : "error", "upstream.http_error", {
        requestId,
        provider: e.provider,
        status: e.status,
        retryAfterMs: e.retryAfterMs,
        error: e.message,
      });
      const headers = new Headers();
      if (typeof e.retryAfterMs === "number") headers.set("Retry-After", String(Math.ceil(e.retryAfterMs / 1000)));
      headers.set("X-Request-Id", requestId);
      return Response.json(
        { error: e.status === 429 ? "Rate limited." : "Upstream provider error.", provider: e.provider, detail: e.message, requestId },
        { status: e.status, headers },
      );
    }
    const msg = e instanceof Error ? e.message : "Unknown error";
    return Response.json({ error: msg, requestId }, { status: 500, headers: { "X-Request-Id": requestId } });
  }
}
