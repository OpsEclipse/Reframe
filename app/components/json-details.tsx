import type { ReactNode } from "react";

export type JsonDetailsProps = {
  summary?: ReactNode;
  value: unknown;
  className?: string;
};

export default function JsonDetails({ summary = "Raw JSON", value, className }: JsonDetailsProps) {
  return (
    <details
      className={[
        "mt-3",
        "ch26-surface ch26-surface--glass-soft",
        "px-4 py-3 text-sm",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <summary className="cursor-pointer select-none text-xs font-semibold text-zinc-700 dark:text-zinc-200">
        {summary}
      </summary>
      <pre className="mt-3 ch26-codeblock">{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

