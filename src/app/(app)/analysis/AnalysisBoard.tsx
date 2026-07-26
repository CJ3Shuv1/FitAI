"use client";

import { useState } from "react";
import Link from "next/link";
import { runAnalysis } from "./actions";

export default function AnalysisBoard({
  initialContent,
  initialCreatedAt,
  hasAiKey,
  moduleLabels,
}: {
  initialContent: string | null;
  initialCreatedAt: string | null;
  hasAiKey: boolean;
  moduleLabels: { key: string; label: string; emoji: string }[];
}) {
  const [content, setContent] = useState(initialContent);
  const [createdAt, setCreatedAt] = useState(initialCreatedAt);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function analyze() {
    setLoading(true);
    setError(null);
    const result = await runAnalysis();
    if ("error" in result) {
      setError(result.error);
    } else {
      setContent(result.content);
      setCreatedAt(new Date().toISOString());
    }
    setLoading(false);
  }

  return (
    <div>
      <h1 className="mb-1 text-3xl font-extrabold uppercase tracking-tight">
        Gesamtanalyse
      </h1>
      <p className="mb-5 text-sm text-[var(--text-dim)]">
        Ein KI-Blick über alle Bereiche zusammen.
      </p>

      <div className="mb-5 flex flex-wrap gap-2">
        {moduleLabels.map((m) => (
          <span
            key={m.key}
            className="flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-3 py-1.5 text-[13px] font-semibold text-[var(--text-dim)]"
          >
            <span>{m.emoji}</span>
            {m.label}
          </span>
        ))}
      </div>

      {!hasAiKey && (
        <div className="mb-5 rounded-2xl border border-[var(--copper-dim)] bg-[rgba(217,123,63,0.08)] p-4">
          <p className="mb-3 text-[13px] text-[var(--text-dim)]">
            Für die Gesamtanalyse wird ein KI-Key benötigt (Gemini oder Groq).
          </p>
          <Link
            href="/settings"
            className="block w-full rounded-xl bg-[var(--copper)] py-3 text-center text-sm font-bold text-[#1A1209]"
          >
            Jetzt in den Einstellungen hinterlegen
          </Link>
        </div>
      )}

      <button
        onClick={analyze}
        disabled={loading || !hasAiKey}
        className="mb-5 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--copper)] p-3.5 text-sm font-bold text-[#1A1209] disabled:opacity-40"
      >
        {loading ? "Analysiere…" : content ? "🔄 Neu bewerten" : "🤖 Gesamtanalyse erstellen"}
      </button>

      {error && <p className="mb-4 text-sm text-[#C97268]">{error}</p>}

      {content && (
        <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
          {createdAt && (
            <div className="mb-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
              {new Date(createdAt).toLocaleString("de-DE")}
            </div>
          )}
          <p className="whitespace-pre-wrap text-[14.5px] leading-relaxed text-[var(--text)]">
            {content}
          </p>
        </div>
      )}
    </div>
  );
}
