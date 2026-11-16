"use client";

import { useEffect, useRef, useState } from "react";
import { countryName } from "@/lib/world/countries";
import { uploadCountryPhotos } from "@/lib/world/photoStore";
import {
  WORLD_STATUSES,
  type CountryEntry,
  type PhotoRef,
  type WorldRoute,
  type WorldStatus,
} from "@/lib/world/types";
import { addPhotos, deleteCountry, removePhoto, saveCountry } from "./actions";

const fieldClass =
  "w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm outline-none focus:border-[var(--copper)]";
const labelClass =
  "mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]";

export default function CountryPanel({
  iso3,
  entry,
  photoUrls,
  onClose,
  onChanged,
  showToast,
}: {
  iso3: string;
  entry: CountryEntry | undefined;
  photoUrls: Record<string, string>;
  onClose: () => void;
  onChanged: () => void;
  showToast: (msg: string) => void;
}) {
  const [status, setStatus] = useState<WorldStatus | null>(entry?.status ?? null);
  const [dateFrom, setDateFrom] = useState(entry?.dateFrom ?? "");
  const [dateTo, setDateTo] = useState(entry?.dateTo ?? "");
  const [km, setKm] = useState(entry?.km != null ? String(entry.km) : "");
  const [note, setNote] = useState(entry?.note ?? "");
  const [routes, setRoutes] = useState<WorldRoute[]>(entry?.routes ?? []);
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [lightbox, setLightbox] = useState<PhotoRef | null>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lightbox) setLightbox(null);
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox, onClose]);

  const edit = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setDirty(true);
  };

  async function persist(nextStatus: WorldStatus) {
    setBusy(true);
    const kmValue = km.trim() === "" ? null : parseFloat(km.replace(",", "."));
    const result = await saveCountry({
      iso3,
      status: nextStatus,
      dateFrom: dateFrom || null,
      dateTo: dateTo || null,
      note,
      km: kmValue != null && !Number.isNaN(kmValue) ? kmValue : null,
      routes,
    });
    setBusy(false);
    if ("error" in result) {
      showToast(result.error);
      return;
    }
    setStatus(nextStatus);
    setDirty(false);
    showToast("Gespeichert");
    onChanged();
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const refs = await uploadCountryPhotos(iso3, Array.from(files));
      const result = await addPhotos(iso3, refs);
      if ("error" in result) showToast(result.error);
      else {
        showToast(refs.length === 1 ? "Foto gespeichert" : `${refs.length} Fotos gespeichert`);
        onChanged();
      }
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Upload fehlgeschlagen");
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  const photos = entry?.photos ?? [];
  const name = countryName(iso3);

  return (
    <>
      <aside
        role="dialog"
        aria-label={`Details zu ${name}`}
        className="fixed inset-x-0 bottom-0 z-40 mx-auto max-h-[72dvh] w-full max-w-[560px] overflow-y-auto rounded-t-[22px] border border-b-0 border-[var(--hairline)] bg-[var(--surface-raised)] p-4 pb-8 shadow-[0_-12px_40px_rgba(0,0,0,0.45)] xl:inset-y-0 xl:left-auto xl:right-0 xl:mx-0 xl:max-h-none xl:w-[340px] xl:rounded-none xl:border-y-0 xl:border-r-0"
      >
        <div className="mx-auto mb-3 h-1 w-10 rounded bg-[var(--hairline)] xl:hidden" />

        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2
              ref={headingRef}
              tabIndex={-1}
              className="truncate text-xl font-extrabold tracking-tight outline-none"
            >
              {name}
            </h2>
            <p className="text-[12.5px] text-[var(--text-dim)]">
              {status
                ? WORLD_STATUSES.find((s) => s.key === status)!.label +
                  (photos.length ? ` · ${photos.length} Foto${photos.length === 1 ? "" : "s"}` : "")
                : "Noch nicht eingetragen — wähl einen Status."}
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Details schließen"
            className="h-9 w-9 shrink-0 rounded-lg text-lg text-[var(--text-faint)]"
          >
            ✕
          </button>
        </div>

        <div role="group" aria-label="Status" className="mb-4 flex gap-1.5">
          {WORLD_STATUSES.map((s) => (
            <button
              key={s.key}
              disabled={busy}
              aria-pressed={status === s.key}
              onClick={() => persist(s.key)}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-xl border py-2.5 text-[13px] font-semibold ${
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

        {status && (
          <>
            <div className="mb-3 grid grid-cols-2 gap-2.5">
              <label>
                <span className={labelClass}>Von</span>
                <input
                  type="date"
                  value={dateFrom}
                  onChange={(e) => edit(setDateFrom)(e.target.value)}
                  className={fieldClass}
                />
              </label>
              <label>
                <span className={labelClass}>Bis</span>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => edit(setDateTo)(e.target.value)}
                  className={fieldClass}
                />
              </label>
            </div>

            <label className="mb-3 block">
              <span className={labelClass}>Gefahrene Kilometer</span>
              <input
                type="number"
                inputMode="decimal"
                min={0}
                value={km}
                onChange={(e) => edit(setKm)(e.target.value)}
                placeholder="z. B. 850"
                className={fieldClass}
              />
            </label>

            <label className="mb-4 block">
              <span className={labelClass}>Notiz</span>
              <textarea
                value={note}
                onChange={(e) => edit(setNote)(e.target.value)}
                placeholder="Was war gut, was würdest du anders machen?"
                className={fieldClass + " min-h-[76px] resize-y"}
              />
            </label>

            <div className={labelClass}>Routen (Google-Maps-Links)</div>
            <div className="mb-2 space-y-2">
              {routes.map((r, i) => (
                <div
                  key={i}
                  className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2.5"
                >
                  <div className="mb-2 flex gap-2">
                    <input
                      value={r.title}
                      aria-label={`Titel der Route ${i + 1}`}
                      onChange={(e) =>
                        edit(setRoutes)(
                          routes.map((x, j) => (j === i ? { ...x, title: e.target.value } : x))
                        )
                      }
                      placeholder="Titel (z. B. Küstenstraße SH8)"
                      className="min-w-0 flex-1 border-b border-[var(--hairline)] bg-transparent pb-1 text-sm outline-none focus:border-[var(--copper)]"
                    />
                    <button
                      onClick={() => edit(setRoutes)(routes.filter((_, j) => j !== i))}
                      aria-label={`Route ${i + 1} entfernen`}
                      className="shrink-0 px-1 text-[var(--text-faint)]"
                    >
                      ✕
                    </button>
                  </div>
                  <input
                    value={r.url}
                    aria-label={`Link der Route ${i + 1}`}
                    inputMode="url"
                    onChange={(e) =>
                      edit(setRoutes)(
                        routes.map((x, j) => (j === i ? { ...x, url: e.target.value } : x))
                      )
                    }
                    placeholder="https://maps.app.goo.gl/…"
                    className="mb-2 w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2 font-mono text-[12px] outline-none focus:border-[var(--copper)]"
                  />
                  {/^https?:\/\//i.test(r.url.trim()) && (
                    <a
                      href={r.url.trim()}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block rounded-lg border border-[var(--hairline)] py-2 text-center text-[13px] font-semibold text-[var(--copper)]"
                    >
                      Route öffnen ↗
                    </a>
                  )}
                </div>
              ))}
            </div>
            <button
              onClick={() => edit(setRoutes)([...routes, { title: "", url: "" }])}
              className="mb-4 w-full rounded-xl border border-dashed border-[var(--hairline)] p-2.5 text-sm text-[var(--text-faint)]"
            >
              + Route hinzufügen
            </button>

            {dirty && (
              <button
                onClick={() => persist(status)}
                disabled={busy}
                className="mb-4 w-full rounded-xl bg-[var(--copper)] py-3 text-sm font-bold text-[#1A1209] disabled:opacity-60"
              >
                {busy ? "Speichere…" : "Änderungen speichern"}
              </button>
            )}

            <div className={labelClass}>Fotos</div>
            {photos.length > 0 && (
              <div className="mb-2 grid grid-cols-3 gap-1.5">
                {photos.map((p) => (
                  <button
                    key={p.path}
                    onClick={() => setLightbox(p)}
                    aria-label="Foto groß anzeigen"
                    className="aspect-square overflow-hidden rounded-lg bg-[var(--surface)]"
                  >
                    {photoUrls[p.path] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={photoUrls[p.path]}
                        alt={`Foto aus ${name}`}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : null}
                  </button>
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => handleFiles(e.target.files)}
            />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="mb-5 w-full rounded-xl border border-dashed border-[var(--hairline)] p-2.5 text-sm text-[var(--text-faint)] disabled:opacity-60"
            >
              {uploading ? "Lade hoch…" : "+ Fotos hinzufügen"}
            </button>

            <button
              onClick={async () => {
                if (!confirm(`„${name}“ samt Notiz, Routen und Fotos entfernen?`)) return;
                const result = await deleteCountry(iso3);
                if ("error" in result) showToast(result.error);
                else {
                  showToast("Eintrag entfernt");
                  onChanged();
                  onClose();
                }
              }}
              className="w-full text-center font-mono text-[10.5px] text-[var(--text-faint)] underline"
            >
              Eintrag entfernen
            </button>
          </>
        )}
      </aside>

      {lightbox && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Foto-Großansicht"
          className="fixed inset-0 z-50 flex flex-col bg-black/90"
          onClick={() => setLightbox(null)}
        >
          <div className="flex justify-between p-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={async () => {
                if (!confirm("Dieses Foto löschen?")) return;
                const result = await removePhoto(iso3, lightbox.path);
                if ("error" in result) showToast(result.error);
                else {
                  setLightbox(null);
                  onChanged();
                }
              }}
              className="rounded-lg px-3 py-2 text-sm text-white/80"
            >
              Foto löschen
            </button>
            <button
              onClick={() => setLightbox(null)}
              aria-label="Großansicht schließen"
              className="h-10 w-10 rounded-lg text-xl text-white"
            >
              ✕
            </button>
          </div>
          <div className="flex min-h-0 flex-1 items-center justify-center p-3">
            {photoUrls[lightbox.path] && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={photoUrls[lightbox.path]}
                alt={`Foto aus ${name}`}
                className="max-h-full max-w-full rounded-lg object-contain"
              />
            )}
          </div>
        </div>
      )}
    </>
  );
}
