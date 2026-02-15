"use client";

import { useMemo, useState, type FormEvent } from "react";
import JournalEntries from "./components/JournalEntries";
import { parseJournalEntriesFromUnknown } from "./lib/journal";

type IngestResult =
  | { ok: true; status: number; data: unknown }
  | { ok: false; status: number; error: string; details?: unknown };

function prettyJson(value: unknown) {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export default function IngestUploader() {
  const [file, setFile] = useState<File | null>(null);
  const [processPdf, setProcessPdf] = useState(true);
  const [includeMarkdown, setIncludeMarkdown] = useState(true);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<IngestResult | null>(null);

  const endpoint = useMemo(() => {
    const params = new URLSearchParams();
    params.set("process_pdf", String(processPdf));
    params.set("include_markdown", String(includeMarkdown));
    return `/api/ingest?${params.toString()}`;
  }, [includeMarkdown, processPdf]);

  const parsedJournalEntries = useMemo(() => {
    if (!result?.ok) return null;
    return parseJournalEntriesFromUnknown(result.data);
  }, [result]);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setResult(null);

    if (!file) {
      setResult({ ok: false, status: 0, error: "Pick a file first." });
      return;
    }

    setBusy(true);
    try {
      const form = new FormData();
      form.set("file", file, file.name);

      const res = await fetch(endpoint, { method: "POST", body: form });

      const ct = res.headers.get("content-type") || "";
      const data = ct.includes("application/json")
        ? await res.json()
        : await res.text();

      if (!res.ok) {
        setResult({
          ok: false,
          status: res.status,
          error: "Ingest failed.",
          details: data,
        });
        return;
      }

      setResult({ ok: true, status: res.status, data });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({ ok: false, status: 0, error: message });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-16">
      <div className="space-y-2">
        <h1 className="text-balance text-2xl font-semibold tracking-tight">
          Ingest
        </h1>
        <p className="text-pretty text-sm text-zinc-600 dark:text-zinc-400">
          Upload a file and POST it as multipart/form-data to{" "}
          <span className="font-mono text-[0.95em] text-zinc-900 dark:text-zinc-100">
            /ingest
          </span>{" "}
          via a same-origin proxy.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="mt-8 rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950"
      >
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-sm font-medium">File</label>
            <div className="flex w-full items-center rounded-xl border border-zinc-200 bg-zinc-50 p-2 dark:border-zinc-800 dark:bg-zinc-900">
              <span className="min-w-0 flex-1 truncate px-1 text-sm text-zinc-700 dark:text-zinc-100">
                {file ? file.name : "No file selected"}
              </span>
              <input
                id="ingest-file-input"
                type="file"
                className="sr-only"
                onChange={(ev) => setFile(ev.target.files?.[0] ?? null)}
              />
              <label
                htmlFor="ingest-file-input"
                className="ml-2 inline-flex h-9 w-9 items-center justify-center rounded-lg border border-zinc-300 bg-white text-zinc-900 shadow-sm transition hover:bg-zinc-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:hover:bg-zinc-800"
              >
                <span className="sr-only">Browse files</span>
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
                  <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
                </svg>
              </label>
            </div>
            <div className="text-xs text-zinc-500 dark:text-zinc-500">
              Field name: <span className="font-mono">file</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="flex cursor-pointer select-none items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="font-medium">process_pdf</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
                checked={processPdf}
                onChange={(e) => setProcessPdf(e.target.checked)}
              />
            </label>
            <label className="flex cursor-pointer select-none items-center justify-between rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm dark:border-zinc-800 dark:bg-zinc-900">
              <span className="font-medium">include_markdown</span>
              <input
                type="checkbox"
                className="h-4 w-4 accent-zinc-900 dark:accent-zinc-100"
                checked={includeMarkdown}
                onChange={(e) => setIncludeMarkdown(e.target.checked)}
              />
            </label>
          </div>

          <div className="flex items-center justify-between gap-3">
            <button
              type="submit"
              disabled={busy}
              className="inline-flex h-11 items-center justify-center rounded-full bg-zinc-900 px-5 text-sm font-medium text-white shadow-sm transition hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white"
            >
              {busy ? "Uploading..." : "Upload"}
            </button>
            <div className="text-right text-xs text-zinc-500 dark:text-zinc-500">
              POST{" "}
              <span className="font-mono text-zinc-700 dark:text-zinc-300">
                {endpoint}
              </span>
            </div>
          </div>
        </div>
      </form>

      <div className="mt-6">
        {result ? (
          <div
            className={`rounded-2xl border p-4 ${
              result.ok
                ? "border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100"
                : "border-rose-200 bg-rose-50 text-rose-950 dark:border-rose-900/60 dark:bg-rose-950/30 dark:text-rose-100"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="text-sm font-medium">
                {result.ok ? "Success" : "Error"}
              </div>
              <div className="text-xs opacity-80">
                HTTP <span className="font-mono">{result.status}</span>
              </div>
            </div>

            {result.ok && parsedJournalEntries ? (
              <>
                <JournalEntries entries={parsedJournalEntries} />
                <details className="mt-4 rounded-xl bg-white/60 p-3 text-xs leading-5 dark:bg-black/30">
                  <summary className="cursor-pointer select-none font-medium marker:hidden">
                    Raw response
                  </summary>
                  <pre className="mt-3 max-h-[50vh] overflow-auto whitespace-pre-wrap">
{prettyJson(result.data)}
                  </pre>
                </details>
              </>
            ) : (
              <pre className="mt-3 max-h-[50vh] overflow-auto rounded-xl bg-white/60 p-3 text-xs leading-5 dark:bg-black/30">
{prettyJson(result.ok ? result.data : { error: result.error, details: result.details })}
              </pre>
            )}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-zinc-200 p-6 text-sm text-zinc-500 dark:border-zinc-800 dark:text-zinc-500">
            Response will show here.
          </div>
        )}
      </div>

      <div className="mt-6 text-xs text-zinc-500 dark:text-zinc-500">
        Server env override: <span className="font-mono">INGEST_API_BASE_URL</span>
      </div>
    </div>
  );
}
