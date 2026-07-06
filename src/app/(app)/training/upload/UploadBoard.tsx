"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { UserSettings } from "@/lib/types";
import { extractPlanFromFile } from "@/lib/planExtract";
import { commitExtractedPlan, type ExtractedDay } from "./actions";

export default function UploadBoard({ settings }: { settings: UserSettings | null }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [extracted, setExtracted] = useState<ExtractedDay[] | null>(null);

  async function handleFiles(files: File[]) {
    setError(null);
    setExtracted(null);
    setLoading(true);
    try {
      const results = await Promise.all(
        files.map((file) => extractPlanFromFile(file, settings?.gemini_key ?? ""))
      );
      const days = results.flat();
      if (days.length === 0) {
        setError("Es konnten keine Trainingstage erkannt werden. Bitte prüfe die Datei(en) oder lege den Plan manuell an.");
      } else {
        setExtracted(days);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (!settings?.gemini_key) {
    return (
      <div>
        <h1 className="mb-4 text-2xl font-extrabold uppercase tracking-tight">Plan hochladen</h1>
        <p className="mb-4 text-sm text-[var(--text-dim)]">
          Für die automatische Erkennung aus PDF/Foto/Excel wird ein Gemini API-Key benötigt.
        </p>
        <Link
          href="/settings"
          className="block w-full rounded-xl bg-[var(--copper)] py-3 text-center text-sm font-bold text-[#1A1209]"
        >
          Jetzt in den Einstellungen hinterlegen
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold uppercase tracking-tight">Plan hochladen</h1>
      <p className="mb-4 text-sm text-[var(--text-dim)]">
        PDF, Fotos (PNG/JPG) oder Excel (.xlsx) deines Trainingsplans — auch mehrere Dateien auf einmal (z.B. ein Foto pro Trainingstag). Wir extrahieren die Übungen automatisch.
      </p>

      <label className="mb-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--hairline)] p-8 text-center text-sm text-[var(--text-faint)]">
        {loading ? "Analysiere Datei(en)…" : "Datei(en) auswählen"}
        <input
          type="file"
          accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls"
          multiple
          className="hidden"
          disabled={loading}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length > 0) handleFiles(files);
            e.target.value = "";
          }}
        />
      </label>

      {error && <p className="mb-4 text-sm text-[#C97268]">{error}</p>}

      {extracted && (
        <div>
          <div className="mb-3 text-sm font-semibold text-[var(--text-dim)]">
            Erkannt — bitte prüfen, bevor du übernimmst:
          </div>
          {extracted.map((day, dIdx) => (
            <div key={dIdx} className="mb-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
              <input
                value={day.label}
                onChange={(e) =>
                  setExtracted((prev) =>
                    prev!.map((d, i) => (i === dIdx ? { ...d, label: e.target.value } : d))
                  )
                }
                className="mb-2 w-full bg-transparent text-base font-bold outline-none"
              />
              {day.exercises.map((ex, eIdx) => (
                <div key={eIdx} className="flex items-center gap-2 border-b border-[var(--hairline)] py-2 text-sm last:border-none">
                  <input
                    value={ex.name}
                    onChange={(e) =>
                      setExtracted((prev) =>
                        prev!.map((d, i) =>
                          i === dIdx
                            ? {
                                ...d,
                                exercises: d.exercises.map((x, j) =>
                                  j === eIdx ? { ...x, name: e.target.value } : x
                                ),
                              }
                            : d
                        )
                      )
                    }
                    className="flex-1 bg-transparent outline-none"
                  />
                  <span className="font-mono text-xs text-[var(--text-faint)]">
                    {ex.sets ?? "–"}×{ex.weight ? ex.weight + "kg" : "–"}
                  </span>
                  <button
                    onClick={() =>
                      setExtracted((prev) =>
                        prev!.map((d, i) =>
                          i === dIdx
                            ? { ...d, exercises: d.exercises.filter((_, j) => j !== eIdx) }
                            : d
                        )
                      )
                    }
                    className="text-[var(--text-faint)]"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          ))}

          <button
            onClick={async () => {
              await commitExtractedPlan(extracted);
              router.push("/training");
              router.refresh();
            }}
            className="w-full rounded-2xl bg-[var(--copper)] py-3.5 text-sm font-bold text-[#1A1209]"
          >
            Übernehmen
          </button>
        </div>
      )}
    </div>
  );
}
