import { memo } from "react";
import type { JournalEntry } from "../lib/journal";
import { dateIntToIso } from "../lib/journal";

const dateFmt = new Intl.DateTimeFormat("en-US", {
  year: "numeric",
  month: "short",
  day: "2-digit",
});

function formatDateLabel(dateInt: number): string {
  const iso = dateIntToIso(dateInt);
  if (!iso) return String(dateInt);
  // Force local time noon-ish by using Date.UTC; avoids TZ edge cases around midnight.
  const y = Number(iso.slice(0, 4));
  const m = Number(iso.slice(5, 7));
  const d = Number(iso.slice(8, 10));
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0));
  return dateFmt.format(dt);
}

function Tag({ children }: { children: string }) {
  return (
    <span className="inline-flex items-center rounded-full border border-zinc-200 bg-white px-2 py-0.5 text-[11px] font-medium text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-200">
      {children}
    </span>
  );
}

function TagGroup({
  label,
  values,
}: {
  label: string;
  values: string[];
}) {
  if (values.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        {label}
      </p>
      <div className="flex flex-wrap gap-2">
        {values.map((value) => (
          <Tag key={`${label}:${value}`}>{value}</Tag>
        ))}
      </div>
    </div>
  );
}

function EntryCardBase({ entry }: { entry: JournalEntry }) {
  const dateLabel = formatDateLabel(entry.dateInt);

  return (
    <article className="rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
      <header className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="text-balance text-base font-semibold leading-6 tracking-tight">
            {entry.title}
          </h3>
          {entry.contextSummary ? (
            <p className="mt-1 text-pretty text-sm text-zinc-600 dark:text-zinc-400">
              {entry.contextSummary}
            </p>
          ) : null}
        </div>
        <div className="shrink-0 text-right">
          <div className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {dateLabel}
          </div>
          {entry.extractedDateInt ? (
            <div className="mt-1 font-mono text-[11px] text-zinc-500 dark:text-zinc-500">
              {entry.extractedDateInt}
            </div>
          ) : null}
        </div>
      </header>

      <div className="mt-4 space-y-3">
        <p className="whitespace-pre-wrap text-sm leading-6 text-zinc-900 dark:text-zinc-100">
          {entry.content}
        </p>

        <div className="space-y-4">
          <TagGroup label="Emotions" values={entry.emotions} />
          <TagGroup label="Keywords" values={entry.keywords} />
          <TagGroup label="People" values={entry.people} />
        </div>
      </div>
    </article>
  );
}

const EntryCard = memo(EntryCardBase);

export default function JournalEntries({ entries }: { entries: JournalEntry[] }) {
  return (
    <section className="mt-6">
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="text-sm font-semibold tracking-tight">Journal entries</h2>
        <div className="text-xs text-zinc-500 dark:text-zinc-500">
          {entries.length} item{entries.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="mt-3 space-y-4">
        {entries.map((entry) => (
          <EntryCard key={`${entry.dateInt}:${entry.title}`} entry={entry} />
        ))}
      </div>
    </section>
  );
}
