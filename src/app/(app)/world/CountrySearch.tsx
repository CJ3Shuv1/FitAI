"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { searchCountries, type Country } from "@/lib/world/countries";
import { WORLD_STATUSES, statusMeta, type CountryEntry, type WorldStatus } from "@/lib/world/types";
import { saveCountry } from "./actions";

export default function CountrySearch({
  entries,
  onClose,
  onSaved,
  showToast,
}: {
  entries: Record<string, CountryEntry>;
  onClose: () => void;
  onSaved: (iso3: string) => void;
  showToast: (msg: string) => void;
}) {
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Country | null>(null);
  const [status, setStatus] = useState<WorldStatus>("visited");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchCountries(query).slice(0, 60), [query]);

  useEffect(() => {
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function pick(c: Country) {
    const existing = entries[c.iso3];
    setPicked(c);
    setStatus(existing?.status ?? "visited");
    setDateFrom(existing?.dateFrom ?? "");
    setDateTo(existing?.dateTo ?? "");
  }

  async function save() {
    if (!picked) return;
    setSaving(true);
    const existing = entries[picked.iso3];
    const result = await saveCountry({
      iso3: picked.iso3,
      status,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      note: existing?.note ?? null,
      km: existing?.km ?? null,
      routes: existing?.routes ?? [],
      places: existing?.places ?? [],
    });
    setSaving(false);
    if ("error" in result) {
      showToast(result.error);
      return;
    }
    showToast(`${picked.nameDe} eingetragen`);
    onSaved(picked.iso3);
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/70"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Land eintragen"
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-[560px] flex-col rounded-t-[22px] border border-b-0 border-[var(--hairline)] bg-[var(--bg)] p-4 pb-6"
      >
        <div className="mx-auto mb-3 h-1 w-10 shrink-0 rounded bg-[var(--hairline)]" />
        <div className="mb-3 flex shrink-0 items-center justify-between">
          <h2 className="text-[20px] font-extrabold tracking-tight">Land eintragen</h2>
          <button
            onClick={onClose}
            aria-label="Schließen"
            className="h-9 w-9 rounded-lg text-lg text-[var(--text-faint)]"
          >
            ✕
          </button>
        </div>

        {!picked ? (
          <>
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Land suchen (deutsch oder englisch)"
              aria-label="Land suchen"
              className="mb-3 w-full shrink-0 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-3 text-base outline-none focus:border-[var(--copper)]"
            />
            <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto" aria-label="Suchergebnisse">
              {results.map((c) => {
                const existing = entries[c.iso3];
                return (
                  <li key={c.iso3}>
                    <button
                      onClick={() => pick(c)}
                      className="flex w-full items-center justify-between gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-3 text-left"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold">{c.nameDe}</span>
                        {c.nameEn !== c.nameDe && (
                          <span className="block truncate text-[11.5px] text-[var(--text-faint)]">
                            {c.nameEn}
                          </span>
                        )}
                      </span>
                      {existing && (
                        <span className="flex shrink-0 items-center gap-1.5 font-mono text-[10px] uppercase text-[var(--text-dim)]">
                          <span
                            className="h-2 w-2 rounded-full"
                            style={{ background: statusMeta(existing.status).color }}
                          />
                          {statusMeta(existing.status).label}
                        </span>
                      )}
                    </button>
                  </li>
                );
              })}
              {results.length === 0 && (
                <li className="p-6 text-center text-sm text-[var(--text-faint)]">
                  Kein Land gefunden für „{query}“.
                </li>
              )}
            </ul>
          </>
        ) : (
          <div>
            <button
              onClick={() => setPicked(null)}
              className="mb-3 font-mono text-[11px] text-[var(--text-faint)] underline"
            >
              ← anderes Land
            </button>
            <div className="mb-4 text-lg font-bold">{picked.nameDe}</div>

            <div role="group" aria-label="Status" className="mb-4 flex gap-1.5">
              {WORLD_STATUSES.map((s) => (
                <button
                  key={s.key}
                  aria-pressed={status === s.key}
                  onClick={() => setStatus(s.key)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-3 text-[13px] font-semibold ${
                    status === s.key
                      ? "border-[var(--text)] bg-[var(--surface)] text-[var(--text)]"
                      : "border-[var(--hairline)] text-[var(--text-faint)]"
                  }`}
                >
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </button>
              ))}
            </div>

            <div className="mb-5 grid grid-cols-2 gap-2.5">
              <label>
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                  Von (optional)
                </span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm"
                />
              </label>
              <label>
                <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                  Bis (optional)
                </span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm"
                />
              </label>
            </div>

            <button
              onClick={save}
              disabled={saving}
              className="w-full rounded-2xl bg-[var(--copper)] py-3.5 text-sm font-bold text-[#1A1209] disabled:opacity-60"
            >
              {saving ? "Speichere…" : "Speichern"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
