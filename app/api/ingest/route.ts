export const runtime = "nodejs";

function getBooleanQueryParam(
  value: string | null,
  fallback: boolean,
): boolean {
  if (value === null) return fallback;
  if (value === "true") return true;
  if (value === "false") return false;
  return fallback;
}

export async function POST(req: Request) {
  const apiBaseUrl = process.env.INGEST_API_BASE_URL ?? "http://localhost:8000";

  const url = new URL(req.url);
  const processPdf = getBooleanQueryParam(
    url.searchParams.get("process_pdf"),
    true,
  );
  const includeMarkdown = getBooleanQueryParam(
    url.searchParams.get("include_markdown"),
    true,
  );

  let incomingForm: FormData;
  try {
    incomingForm = await req.formData();
  } catch {
    return Response.json(
      { error: "Expected multipart/form-data with a 'file' field." },
      { status: 400 },
    );
  }

  const file = incomingForm.get("file");
  if (!(file instanceof File)) {
    return Response.json(
      { error: "Missing 'file' field in multipart/form-data." },
      { status: 400 },
    );
  }

  const upstreamUrl = new URL("/ingest", apiBaseUrl);
  upstreamUrl.searchParams.set("process_pdf", String(processPdf));
  upstreamUrl.searchParams.set("include_markdown", String(includeMarkdown));

  const upstreamForm = new FormData();
  upstreamForm.set("file", file, file.name || "upload");

  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(upstreamUrl, {
      method: "POST",
      body: upstreamForm,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return Response.json(
      {
        error: "Failed to reach ingest API.",
        details: message,
        upstream: upstreamUrl.toString(),
      },
      { status: 502 },
    );
  }

  // Pass through content-type and status; keep body as-is (JSON or text).
  const headers = new Headers();
  const contentType = upstreamRes.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);

  return new Response(upstreamRes.body, {
    status: upstreamRes.status,
    headers,
  });
}

