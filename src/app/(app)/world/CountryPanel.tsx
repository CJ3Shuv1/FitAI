"use client";

import { useEffect, useRef, useState } from "react";
import { countryName } from "@/lib/world/countries";
import { uploadCountryPhotos } from "@/lib/world/photoStore";
import {
  WORLD_STATUSES,
  type CountryEntry,
  type PhotoRef,
  type WorldPlace,
  type WorldRoute,
  type WorldStatus,
} from "@/lib/world/types";
import { addPhotos, deleteCountry, removePhoto, saveCountry, setPhotoLocation } from "./actions";

const fieldClass =
  "w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm outline-none focus:border-[var(--copper)]";
const labelClass =
  "mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]";

type LinkItem = { title: string; url: string };

/** Editable list of titled Google-Maps links (used for routes and places). */
function LinkList<T extends LinkItem>({
  items,
  onChange,
  blank,
  noun,
  titlePlaceholder,
  urlPlaceholder,
  openLabel,
  addLabel,
  hint,
}: {
  items: T[];
  onChange: (next: T[]) => void;
  blank: T;
  noun: string;
  titlePlaceholder: string;
  urlPlaceholder: string;
  openLabel: string;
  addLabel: string;
  /** Short status line under a saved item (shown on the globe or not). */
  hint: (item: T) => string | null;
}) {
  return (
    <>
      <div className="mb-2 space-y-2">
        {items.map((r, i) => {
          const url = r.url.trim();
          const note = hint(r);
          return (
            <div
              key={i}
              className="rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2.5"
            >
              <div className="mb-2 flex gap-2">
                <input
                  value={r.title}
                  aria-label={`Titel: ${noun} ${i + 1}`}
                  onChange={(e) =>
                    onChange(items.map((x, j) => (j === i ? { ...x, title: e.target.value } : x)))
                  }
                  placeholder={titlePlaceholder}
                  className="min-w-0 flex-1 border-b border-[var(--hairline)] bg-transparent pb-1 text-sm outline-none focus:border-[var(--copper)]"
                />
                <button
                  onClick={() => onChange(items.filter((_, j) => j !== i))}
                  aria-label={`${noun} ${i + 1} entfernen`}
                  className="shrink-0 px-1 text-[var(--text-faint)]"
                >
                  ✕
                </button>
              </div>
              <input
                value={r.url}
                aria-label={`Link: ${noun} ${i + 1}`}
                onChange={(e) =>
                  onChange(items.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)))
                }
                placeholder={urlPlaceholder}
                className="mb-2 w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2 font-mono text-[12px] outline-none focus:border-[var(--copper)]"
              />
              {note && <p className="mb-2 text-[11.5px] text-[var(--text-faint)]">{note}</p>}
              {/^https?:\/\//i.test(url) && (
                <a
                  href={url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block rounded-lg border border-[var(--hairline)] py-2 text-center text-[13px] font-semibold text-[var(--copper)]"
                >
                  {openLabel} ↗
                </a>
              )}
            </div>
          );
        })}
      </div>
      <button
        onClick={() => onChange([...items, blank])}
        className="mb-4 w-full rounded-xl border border-dashed border-[var(--hairline)] p-2.5 text-sm text-[var(--text-faint)]"
      >
        {addLabel}
      </button>
    </>
  );
}

export default function CountryPanel({
  iso3,
  entry,
  photoUrls,
  initialPhoto,
  onClose,
  onChanged,
  showToast,
}: {
  iso3: string;
  entry: CountryEntry | undefined;
  photoUrls: Record<string, string>;
  /** Opens this photo right away (tapped on the globe). */
  initialPhoto?: string | null;
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
  const [places, setPlaces] = useState<WorldPlace[]>(entry?.places ?? []);
  const [lightboxPath, setLightboxPath] = useState<string | null>(initialPhoto ?? null);
  const [locInput, setLocInput] = useState("");
  const [locBusy, setLocBusy] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (lightboxPath) setLightboxPath(null);
      else onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightboxPath, onClose]);

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
      routes: routes.map((r) => ({ title: r.title, url: r.url })),
      places: places.map((p) => ({ title: p.title, url: p.url })),
    });
    setBusy(false);
    if ("error" in result) {
      showToast(result.error);
      return;
    }
    setStatus(nextStatus);
    setDirty(false);
    showToast(
      result.unresolved
        ? `Gespeichert – bei ${result.unresolved} Link${result.unresolved === 1 ? "" : "s"} wurden keine Koordinaten gefunden (nur als Link gespeichert).`
        : "Gespeichert"
    );
    onChanged();
  }

  async function applyLocation(location: Parameters<typeof setPhotoLocation>[2]) {
    if (!lightboxPath) return;
    setLocBusy(true);
    const result = await setPhotoLocation(iso3, lightboxPath, location);
    setLocBusy(false);
    if ("error" in result) {
      showToast(result.error);
      return;
    }
    setLocInput("");
    showToast(location ? "Standort gespeichert" : "Standort entfernt");
    onChanged();
  }

  function takeDevicePosition() {
    if (!navigator.geolocation) {
      showToast("Dieses Gerät gibt keinen Standort frei.");
      return;
    }
    setLocBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        applyLocation({
          position: {
            lat: Math.round(pos.coords.latitude * 1e5) / 1e5,
            lng: Math.round(pos.coords.longitude * 1e5) / 1e5,
          },
        }),
      () => {
        setLocBusy(false);
        showToast("Standort konnte nicht ermittelt werden (Freigabe erlaubt?).");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const uploads = await uploadCountryPhotos(iso3, Array.from(files));
      const result = await addPhotos(iso3, uploads);
      if ("error" in result) showToast(result.error);
      else {
        const n = uploads.length;
        const located = uploads.filter((u) => u.gps).length;
        const saved = n === 1 ? "Foto gespeichert" : `${n} Fotos gespeichert`;
        showToast(
          located === 0
            ? `${saved} – kein Standort in den Bilddaten, du kannst ihn im Foto nachtragen.`
            : located === n
              ? `${saved} · Standort aus den Bilddaten übernommen 📍`
              : `${saved} · ${located} davon mit Standort aus den Bilddaten 📍`
        );
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
  const lightbox: PhotoRef | null = photos.find((p) => p.path === lightboxPath) ?? null;
  const savedRoutes = entry?.routes ?? [];
  const savedPlaces = entry?.places ?? [];
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
            <LinkList
              items={routes}
              onChange={edit(setRoutes)}
              blank={{ title: "", url: "" }}
              noun="Route"
              titlePlaceholder="Titel (z. B. Küstenstraße SH8)"
              urlPlaceholder="https://maps.app.goo.gl/…"
              openLabel="Route öffnen"
              addLabel="+ Route hinzufügen"
              hint={(r) => {
                const saved = savedRoutes.find((x) => x.url === r.url.trim());
                if (!saved) return null;
                return saved.points
                  ? `Auf dem Globus eingezeichnet (${saved.points.length} Punkte, Luftlinie)`
                  : "Nur als Link – im Link stecken keine Wegpunkte.";
              }}
            />

            <div className={labelClass}>Orte (Google-Maps-Link oder Koordinaten)</div>
            <LinkList
              items={places}
              onChange={edit(setPlaces)}
              blank={{ title: "", url: "", pos: null }}
              noun="Ort"
              titlePlaceholder="Name (z. B. Blaue Grotte)"
              urlPlaceholder="Maps-Link oder 35.8989, 14.5146"
              openLabel="Ort öffnen"
              addLabel="+ Ort hinzufügen"
              hint={(p) => {
                const saved = savedPlaces.find((x) => x.url === p.url.trim());
                if (!saved) return null;
                return saved.pos
                  ? "📍 Auf dem Globus markiert"
                  : "Nur als Link – keine Koordinaten gefunden.";
              }}
            />

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
                    onClick={() => {
                      setLocInput("");
                      setLightboxPath(p.path);
                    }}
                    aria-label={p.loc ? "Foto groß anzeigen (mit Standort)" : "Foto groß anzeigen"}
                    className="relative aspect-square overflow-hidden rounded-lg bg-[var(--surface)]"
                  >
                    {p.loc && (
                      <span className="absolute bottom-1 right-1 rounded-full bg-black/60 px-1 text-[11px]">
                        📍
                      </span>
                    )}
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
                if (!confirm(`„${name}“ samt Notiz, Routen, Orten und Fotos entfernen?`)) return;
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
          onClick={() => setLightboxPath(null)}
        >
          <div className="flex justify-between p-3" onClick={(e) => e.stopPropagation()}>
            <button
              onClick={async () => {
                if (!confirm("Dieses Foto löschen?")) return;
                const result = await removePhoto(iso3, lightbox.path);
                if ("error" in result) showToast(result.error);
                else {
                  setLightboxPath(null);
                  onChanged();
                }
              }}
              className="rounded-lg px-3 py-2 text-sm text-white/80"
            >
              Foto löschen
            </button>
            <button
              onClick={() => setLightboxPath(null)}
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
          <div
            className="mx-auto w-full max-w-[560px] p-3 pb-6 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            {lightbox.loc ? (
              <div className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">
                  📍 {lightbox.loc.lat.toFixed(4)}, {lightbox.loc.lng.toFixed(4)} · auf dem Globus
                  markiert
                </span>
                <a
                  href={lightbox.loc.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg border border-white/30 px-3 py-2 font-semibold"
                >
                  In Maps ↗
                </a>
                <button
                  disabled={locBusy}
                  onClick={() => applyLocation(null)}
                  className="shrink-0 rounded-lg px-2 py-2 text-white/70"
                >
                  Entfernen
                </button>
              </div>
            ) : (
              <>
                <div className="mb-1.5 text-[11px] uppercase tracking-[0.1em] text-white/60">
                  Wo war das? (Google-Maps-Link oder Koordinaten)
                </div>
                <div className="flex gap-2">
                  <input
                    value={locInput}
                    onChange={(e) => setLocInput(e.target.value)}
                    aria-label="Standort des Fotos"
                    placeholder="https://maps.app.goo.gl/…"
                    className="min-w-0 flex-1 rounded-lg border border-white/25 bg-white/10 p-2.5 font-mono text-[12px] text-white outline-none placeholder:text-white/40"
                  />
                  <button
                    disabled={locBusy || locInput.trim() === ""}
                    onClick={() => applyLocation({ link: locInput })}
                    className="shrink-0 rounded-lg bg-[var(--copper)] px-3 text-sm font-bold text-[#1A1209] disabled:opacity-50"
                  >
                    {locBusy ? "…" : "Speichern"}
                  </button>
                </div>
                <button
                  disabled={locBusy}
                  onClick={takeDevicePosition}
                  className="mt-2 w-full rounded-lg border border-white/25 py-2.5 text-[13px] disabled:opacity-50"
                >
                  📍 Aktuellen Standort verwenden
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
