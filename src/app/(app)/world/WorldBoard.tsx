"use client";

import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { countryName } from "@/lib/world/countries";
import {
  WORLD_COUNTRY_TOTAL,
  WORLD_STATUSES,
  type CountryEntry,
  type WorldStatus,
} from "@/lib/world/types";
import GlobeView, { type GlobeMarker, type GlobeRoute } from "./GlobeView";
import CountryPanel from "./CountryPanel";
import CountrySearch from "./CountrySearch";

export default function WorldBoard({
  initialEntries,
  photoUrls,
  setupMissing,
}: {
  initialEntries: CountryEntry[];
  photoUrls: Record<string, string>;
  setupMissing: boolean;
}) {
  const router = useRouter();
  const [selected, setSelected] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), msg.length > 40 ? 5000 : 2200);
  }, []);

  const byIso3 = useMemo(
    () => Object.fromEntries(initialEntries.map((e) => [e.iso3, e])),
    [initialEntries]
  );
  const statusByIso3 = useMemo(
    () =>
      Object.fromEntries(initialEntries.map((e) => [e.iso3, e.status])) as Record<
        string,
        WorldStatus
      >,
    [initialEntries]
  );

  const globeRoutes = useMemo<GlobeRoute[]>(
    () =>
      initialEntries.flatMap((e) =>
        e.routes
          .filter((r) => r.points && r.points.length >= 2)
          .map((r) => ({ iso3: e.iso3, title: r.title, points: r.points! }))
      ),
    [initialEntries]
  );
  const globeMarkers = useMemo<GlobeMarker[]>(
    () =>
      initialEntries.flatMap((e) => [
        ...e.places
          .filter((p) => p.pos)
          .map((p) => ({
            ...p.pos!,
            iso3: e.iso3,
            kind: "place" as const,
            label: p.title || `Ort in ${countryName(e.iso3)}`,
          })),
        ...e.photos
          .filter((p) => p.loc)
          .map((p) => ({
            lat: p.loc!.lat,
            lng: p.loc!.lng,
            iso3: e.iso3,
            kind: "photo" as const,
            label: `Foto aus ${countryName(e.iso3)}`,
          })),
      ]),
    [initialEntries]
  );

  const visited = initialEntries.filter((e) => e.status === "visited").length;
  const percent = (visited / WORLD_COUNTRY_TOTAL) * 100;
  const km = initialEntries.reduce((sum, e) => sum + (e.km ?? 0), 0);
  const closePanel = useCallback(() => setSelected(null), []);
  const closeSearch = useCallback(() => setShowSearch(false), []);

  return (
    <div className="pb-24">
      <div className="mb-2 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold uppercase tracking-tight">Meine Welt</h1>
          <p className="text-sm text-[var(--text-dim)]">
            <b className="font-semibold text-[var(--text)]">{visited}</b>{" "}
            {visited === 1 ? "Land" : "Länder"} besucht ·{" "}
            <b className="font-semibold text-[var(--text)]">
              {percent.toLocaleString("de-DE", { maximumFractionDigits: 1 })} %
            </b>{" "}
            der Welt
            {km > 0 && (
              <>
                {" "}
                · <b className="font-semibold text-[var(--text)]">{km.toLocaleString("de-DE")} km</b>{" "}
                gefahren
              </>
            )}
          </p>
        </div>
        <button
          onClick={() => setShowSearch(true)}
          aria-label="Land suchen und eintragen"
          className="h-10 w-10 shrink-0 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] text-lg"
        >
          🔍
        </button>
      </div>

      <div className="mb-1 flex flex-wrap gap-1.5">
        {WORLD_STATUSES.map((s) => (
          <span
            key={s.key}
            className="flex items-center gap-1.5 rounded-full border border-[var(--hairline)] bg-[var(--surface)] px-2.5 py-1 text-[12px] text-[var(--text-dim)]"
          >
            <span className="h-2 w-2 rounded-full" style={{ background: s.color }} />
            {s.label} {initialEntries.filter((e) => e.status === s.key).length}
          </span>
        ))}
      </div>

      {setupMissing && (
        <div className="my-3 rounded-2xl border border-[var(--copper-dim)] bg-[rgba(217,123,63,0.08)] p-4 text-[13px] text-[var(--text-dim)]">
          <b className="text-[var(--text)]">Datenbank noch nicht eingerichtet.</b> Führe einmal
          die Migration <code className="font-mono">supabase/migrations/0010_world.sql</code> im
          Supabase SQL Editor aus — bis dahin lässt sich nichts speichern.
        </div>
      )}

      <GlobeView
        statusByIso3={statusByIso3}
        selectedIso3={selected}
        routes={globeRoutes}
        markers={globeMarkers}
        onSelect={setSelected}
      />

      {initialEntries.length === 0 ? (
        <div className="mt-2 rounded-2xl border border-dashed border-[var(--hairline)] p-6 text-center">
          <div className="mb-1 text-base font-bold">Trag dein erstes Land ein</div>
          <p className="mb-4 text-[13px] text-[var(--text-faint)]">
            Tipp ein Land auf dem Globus an oder such es über den Button — besucht, geplant oder
            Wunsch.
          </p>
          <button
            onClick={() => setShowSearch(true)}
            className="rounded-xl bg-[var(--copper)] px-5 py-2.5 text-sm font-bold text-[#1A1209]"
          >
            ＋ Land eintragen
          </button>
        </div>
      ) : (
        <div className="mt-3">
          <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
            Meine Länder
          </div>
          <ul className="space-y-1.5">
            {[...initialEntries]
              .sort((a, b) => countryName(a.iso3).localeCompare(countryName(b.iso3), "de"))
              .map((e) => {
                const meta = WORLD_STATUSES.find((s) => s.key === e.status)!;
                return (
                  <li key={e.iso3}>
                    <button
                      onClick={() => setSelected(e.iso3)}
                      className="flex w-full items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-3.5 py-3 text-left"
                    >
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ background: meta.color }}
                      />
                      <span className="min-w-0 flex-1 truncate text-sm font-semibold">
                        {countryName(e.iso3)}
                      </span>
                      <span className="shrink-0 font-mono text-[10.5px] text-[var(--text-faint)]">
                        {meta.label}
                        {e.photos.length > 0 && ` · ${e.photos.length} 📷`}
                        {e.routes.length > 0 && ` · ${e.routes.length} 🧭`}
                        {e.places.length > 0 && ` · ${e.places.length} 📍`}
                      </span>
                    </button>
                  </li>
                );
              })}
          </ul>
        </div>
      )}

      {!selected && !showSearch && initialEntries.length > 0 && (
        <button
          onClick={() => setShowSearch(true)}
          className="fixed bottom-6 right-[max(1rem,calc(50%-16.5rem))] z-20 rounded-full bg-[var(--copper)] px-5 py-3.5 text-sm font-black text-[#1A1209] shadow-[0_10px_26px_rgba(0,0,0,0.45)]"
        >
          ＋ Land eintragen
        </button>
      )}

      {selected && (
        <CountryPanel
          // Remount once the saved entry arrives, so the form starts from it.
          key={`${selected}:${byIso3[selected] ? "saved" : "new"}`}
          iso3={selected}
          entry={byIso3[selected]}
          photoUrls={photoUrls}
          onClose={closePanel}
          onChanged={() => router.refresh()}
          showToast={showToast}
        />
      )}

      {showSearch && (
        <CountrySearch
          entries={byIso3}
          onClose={closeSearch}
          onSaved={(iso3) => {
            setShowSearch(false);
            setSelected(iso3);
            router.refresh();
          }}
          showToast={showToast}
        />
      )}

      {toast && (
        <div
          role="status"
          className="fixed bottom-24 left-1/2 z-[60] max-w-[90vw] -translate-x-1/2 rounded-full border border-[var(--hairline)] bg-[var(--surface-raised)] px-4 py-2.5 text-center text-[12.5px]"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
