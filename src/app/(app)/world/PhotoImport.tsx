"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { countryName, searchCountries } from "@/lib/world/countries";
import { readPhotoMeta, type GpsMissing } from "@/lib/world/exifGps";
import { countryAt } from "@/lib/world/geo";
import { uploadPhotos, type UploadedPhoto } from "@/lib/world/photoStore";
import { statusMeta, type CountryEntry } from "@/lib/world/types";
import { importCountryPhotos } from "./actions";

type Item = {
  file: File;
  preview: string;
  iso3: string | null;
  takenOn: string | null;
  missing: GpsMissing | null;
};

type Phase =
  | { kind: "analyse"; done: number }
  | { kind: "review" }
  | { kind: "upload"; done: number; total: number }
  | { kind: "error"; message: string };

const MISSING_TEXT: Record<GpsMissing, string> = {
  redacted:
    "Die Standortdaten wurden beim Auswählen vom Handy entfernt (Android macht das bei der Galerie-Auswahl im Browser).",
  "no-gps": "Die Fotos enthalten keinen Standort – in der Kamera sind die Standort-Tags wohl aus.",
  "no-exif":
    "Die Dateien enthalten keine Bilddaten (z. B. HEIC/PNG, Screenshots oder weitergeleitete Bilder).",
};

function dateRange(items: Item[]) {
  const dates = items.map((i) => i.takenOn).filter((d): d is string => !!d).sort();
  return { from: dates[0] ?? null, to: dates[dates.length - 1] ?? null };
}

function formatRange({ from, to }: { from: string | null; to: string | null }) {
  const fmt = (d: string) => new Date(d + "T12:00:00").toLocaleDateString("de-DE");
  if (!from) return null;
  return from === to ? fmt(from) : `${fmt(from)} – ${fmt(to!)}`;
}

function Thumbs({ list }: { list: Item[] }) {
  return (
    <div className="mt-2 flex gap-1">
      {list.slice(0, 6).map((i) => (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={i.preview} src={i.preview} alt="" className="h-11 w-11 rounded-md object-cover" />
      ))}
      {list.length > 6 && (
        <span className="flex h-11 w-11 items-center justify-center rounded-md bg-[var(--surface-raised)] text-[12px] text-[var(--text-dim)]">
          +{list.length - 6}
        </span>
      )}
    </div>
  );
}

export default function PhotoImport({
  files,
  entries,
  onClose,
  onDone,
  showToast,
}: {
  files: File[];
  entries: Record<string, CountryEntry>;
  onClose: () => void;
  onDone: (iso3s: string[]) => void;
  showToast: (msg: string) => void;
}) {
  const [phase, setPhase] = useState<Phase>({ kind: "analyse", done: 0 });
  const [items, setItems] = useState<Item[]>([]);
  const [skipped, setSkipped] = useState<Set<string>>(new Set());
  const [unlocatedIso3, setUnlocatedIso3] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const previews = useRef<string[]>([]);

  // Read position + date of every photo and look up its country (offline).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const out: Item[] = [];
      for (const file of files) {
        const meta = await readPhotoMeta(file);
        const iso3 = meta.gps ? await countryAt(meta.gps) : null;
        const preview = URL.createObjectURL(file);
        previews.current.push(preview);
        out.push({
          file,
          preview,
          iso3,
          takenOn: meta.takenOn,
          // Located in the sea far from any coast counts as "no country".
          missing: meta.gps ? null : meta.missing,
        });
        if (cancelled) return;
        setPhase({ kind: "analyse", done: out.length });
      }
      if (cancelled) return;
      // Photos without a position most likely belong to the same trip as
      // the located ones — suggest the most frequent country.
      const counts = new Map<string, number>();
      for (const i of out) if (i.iso3) counts.set(i.iso3, (counts.get(i.iso3) ?? 0) + 1);
      const top = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
      setItems(out);
      setUnlocatedIso3(top);
      setPhase({ kind: "review" });
    })();
    return () => {
      cancelled = true;
    };
  }, [files]);

  useEffect(() => {
    const urls = previews.current;
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && phase.kind !== "upload") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose, phase.kind]);

  const located = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const i of items) if (i.iso3) groups.set(i.iso3, [...(groups.get(i.iso3) ?? []), i]);
    return [...groups.entries()].sort((a, b) => b[1].length - a[1].length);
  }, [items]);
  const unlocated = items.filter((i) => !i.iso3);
  const reasons = [...new Set(unlocated.map((i) => i.missing).filter((m): m is GpsMissing => !!m))];
  const results = useMemo(() => (query.trim() ? searchCountries(query).slice(0, 6) : []), [query]);

  /** Final grouping: located photos + the unlocated batch under the chosen country. */
  const plan = useMemo(() => {
    const groups = new Map<string, Item[]>();
    for (const [iso3, list] of located) if (!skipped.has(iso3)) groups.set(iso3, [...list]);
    if (unlocatedIso3 && !skipped.has("__unlocated") && unlocated.length) {
      groups.set(unlocatedIso3, [...(groups.get(unlocatedIso3) ?? []), ...unlocated]);
    }
    return [...groups.entries()];
  }, [located, unlocated, unlocatedIso3, skipped]);
  const planCount = plan.reduce((n, [, list]) => n + list.length, 0);

  function toggle(key: string) {
    setSkipped((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  async function runImport() {
    let done = 0;
    let failed = 0;
    const imported: string[] = [];
    setPhase({ kind: "upload", done, total: planCount });
    for (const [iso3, list] of plan) {
      // Unreadable photos (e.g. HEIC) are skipped, the rest still goes up.
      const batch = await uploadPhotos(
        iso3,
        list.map((i) => i.file),
        () => setPhase({ kind: "upload", done: ++done, total: planCount })
      );
      failed += batch.failed;
      const uploads: UploadedPhoto[] = batch.uploaded;
      if (uploads.length === 0) continue;
      const result = await importCountryPhotos(iso3, uploads, dateRange(list));
      if ("error" in result) {
        setPhase({ kind: "error", message: `${countryName(iso3)}: ${result.error}` });
        if (imported.length) onDone(imported);
        return;
      }
      imported.push(iso3);
    }
    const ok = done - failed;
    showToast(
      `${ok} Foto${ok === 1 ? "" : "s"} importiert · ${imported.length} ${imported.length === 1 ? "Land" : "Länder"} als besucht markiert` +
        (failed ? ` · ${failed} konnte${failed === 1 ? "" : "n"} nicht gelesen werden (HEIC?)` : "")
    );
    onDone(imported);
  }

  const statusLine = (iso3: string) => {
    const existing = entries[iso3];
    if (!existing) return "neu · wird als besucht markiert";
    if (existing.status === "visited") return "schon besucht · Fotos werden ergänzt";
    return `${statusMeta(existing.status).label} → wird besucht`;
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={phase.kind === "upload" ? undefined : onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Fotos hochladen"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-[560px] flex-col rounded-t-[22px] border border-b-0 border-[var(--hairline)] bg-[var(--bg)] p-4 pb-6"
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded bg-[var(--hairline)]" />
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="text-[20px] font-extrabold tracking-tight">Fotos hochladen</h2>
          {phase.kind !== "upload" && (
            <button
              onClick={onClose}
              aria-label="Schließen"
              className="h-9 w-9 rounded-lg text-lg text-[var(--text-faint)]"
            >
              ✕
            </button>
          )}
        </div>

        {phase.kind === "analyse" && (
          <p className="py-8 text-center text-sm text-[var(--text-dim)]">
            Lese Standorte… {phase.done}/{files.length}
          </p>
        )}

        {phase.kind === "upload" && (
          <div className="py-8 text-center">
            <p className="mb-3 text-sm text-[var(--text-dim)]">
              Lade hoch… {phase.done}/{phase.total}
            </p>
            <div className="mx-auto h-1.5 w-2/3 overflow-hidden rounded bg-[var(--surface)]">
              <div
                className="h-full bg-[var(--copper)] transition-[width]"
                style={{ width: `${(phase.done / Math.max(1, phase.total)) * 100}%` }}
              />
            </div>
          </div>
        )}

        {phase.kind === "error" && (
          <p className="py-6 text-center text-sm text-[var(--text-dim)]">{phase.message}</p>
        )}

        {phase.kind === "review" && (
          <>
            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto">
              {located.map(([iso3, list]) => {
                const off = skipped.has(iso3);
                const range = formatRange(dateRange(list));
                return (
                  <label
                    key={iso3}
                    className={`block rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 ${off ? "opacity-50" : ""}`}
                  >
                    <div className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={!off}
                        onChange={() => toggle(iso3)}
                        className="mt-1 h-4 w-4 accent-[var(--copper)]"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-bold">
                          📍 {countryName(iso3)}{" "}
                          <span className="font-normal text-[var(--text-dim)]">
                            · {list.length} Foto{list.length === 1 ? "" : "s"}
                          </span>
                        </div>
                        <div className="text-[12px] text-[var(--text-faint)]">
                          {statusLine(iso3)}
                          {range && ` · ${range}`}
                        </div>
                        <Thumbs list={list} />
                      </div>
                    </div>
                  </label>
                );
              })}

              {unlocated.length > 0 && (
                <div
                  className={`rounded-xl border border-dashed border-[var(--hairline)] p-3 ${skipped.has("__unlocated") ? "opacity-50" : ""}`}
                >
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={!skipped.has("__unlocated")}
                      onChange={() => toggle("__unlocated")}
                      className="mt-1 h-4 w-4 accent-[var(--copper)]"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-bold">
                        {unlocated.length} Foto{unlocated.length === 1 ? "" : "s"} ohne Standort
                      </div>
                      {reasons.map((r) => (
                        <p key={r} className="text-[12px] text-[var(--text-faint)]">
                          {MISSING_TEXT[r]}
                        </p>
                      ))}
                      <Thumbs list={unlocated} />
                    </div>
                  </label>

                  {!skipped.has("__unlocated") && (
                    <div className="mt-3">
                      <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                        In welchem Land?
                      </div>
                      {unlocatedIso3 && !picking ? (
                        <div className="flex items-center justify-between rounded-lg border border-[var(--copper-dim)] bg-[var(--surface)] px-3 py-2.5">
                          <span className="text-sm font-semibold">
                            {countryName(unlocatedIso3)}
                            <span className="block text-[11.5px] font-normal text-[var(--text-faint)]">
                              {statusLine(unlocatedIso3)}
                            </span>
                          </span>
                          <button
                            onClick={() => setPicking(true)}
                            className="text-[12px] text-[var(--copper)] underline"
                          >
                            ändern
                          </button>
                        </div>
                      ) : (
                        <>
                          <input
                            autoFocus
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Land suchen"
                            aria-label="Land für Fotos ohne Standort"
                            className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm outline-none focus:border-[var(--copper)]"
                          />
                          <ul className="mt-1 space-y-1">
                            {results.map((c) => (
                              <li key={c.iso3}>
                                <button
                                  onClick={() => {
                                    setUnlocatedIso3(c.iso3);
                                    setQuery("");
                                    setPicking(false);
                                  }}
                                  className="w-full rounded-lg bg-[var(--surface)] px-3 py-2 text-left text-sm"
                                >
                                  {c.nameDe}
                                </button>
                              </li>
                            ))}
                          </ul>
                        </>
                      )}
                    </div>
                  )}
                </div>
              )}

              {reasons.includes("redacted") && (
                <p className="rounded-xl bg-[var(--surface)] p-3 text-[12px] text-[var(--text-dim)]">
                  💡 Tipp: Im Auswahl-Fenster oben rechts über <b>⋮ → „Durchsuchen“</b> (oder
                  „Dateien“) gehen und die Fotos aus dem Ordner <b>DCIM/Camera</b> wählen – dann
                  bleiben die Standorte oft erhalten.
                </p>
              )}
            </div>

            <button
              onClick={runImport}
              disabled={planCount === 0}
              className="mt-3 w-full shrink-0 rounded-2xl bg-[var(--copper)] py-3.5 text-sm font-bold text-[#1A1209] disabled:opacity-50"
            >
              {planCount === 0
                ? unlocated.length && !unlocatedIso3
                  ? "Land für die Fotos wählen"
                  : "Nichts ausgewählt"
                : `${planCount} Foto${planCount === 1 ? "" : "s"} importieren`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
