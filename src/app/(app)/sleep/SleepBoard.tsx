"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { SleepLogEntry } from "@/lib/types";
import { dateKeyLocal } from "@/lib/dates";
import { deleteSleep, saveSleep } from "./actions";

export default function SleepBoard({ initialEntries }: { initialEntries: SleepLogEntry[] }) {
  const router = useRouter();
  const today = dateKeyLocal(new Date());
  const [date, setDate] = useState(today);
  const [hours, setHours] = useState(() => {
    const existing = initialEntries.find((e) => e.date === today);
    return existing ? String(existing.hours) : "";
  });
  const [saving, setSaving] = useState(false);

  const avg7 = useMemo(() => {
    const last7 = initialEntries.slice(0, 7);
    if (last7.length === 0) return null;
    return Math.round((last7.reduce((s, e) => s + e.hours, 0) / last7.length) * 10) / 10;
  }, [initialEntries]);

  async function handleSave() {
    const h = parseFloat(hours);
    if (Number.isNaN(h) || h <= 0) return;
    setSaving(true);
    await saveSleep(date, h);
    setSaving(false);
    router.refresh();
  }

  return (
    <div>
      <h1 className="mb-1 text-3xl font-extrabold uppercase tracking-tight">
        Schlaf
      </h1>
      <p className="mb-5 text-sm text-[var(--text-dim)]">
        Wie viele Stunden hast du ungefähr geschlafen?
      </p>

      {avg7 != null && (
        <div className="mb-5 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
          <div className="font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            Ø letzte 7 Einträge
          </div>
          <div className="text-2xl font-bold">{avg7}h</div>
        </div>
      )}

      <div className="mb-5 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
        <div className="mb-3 flex gap-2.5">
          <label className="flex-1">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
              Datum
            </span>
            <input
              type="date"
              value={date}
              max={today}
              onChange={(e) => {
                setDate(e.target.value);
                const existing = initialEntries.find((entry) => entry.date === e.target.value);
                setHours(existing ? String(existing.hours) : "");
              }}
              className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2.5 text-sm"
            />
          </label>
          <label className="w-24 shrink-0">
            <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
              Stunden
            </span>
            <input
              type="number"
              step={0.5}
              min={0}
              max={24}
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              placeholder="7.5"
              className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2.5 text-center text-sm font-bold"
            />
          </label>
        </div>
        <button
          onClick={handleSave}
          disabled={saving || !hours}
          className="w-full rounded-xl bg-[var(--copper)] py-3 text-sm font-bold text-[#1A1209] disabled:opacity-50"
        >
          {saving ? "Speichere…" : "Speichern"}
        </button>
      </div>

      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
        Verlauf
      </div>
      <div className="space-y-2">
        {initialEntries.map((e) => (
          <div
            key={e.id}
            className="flex items-center justify-between rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3"
          >
            <span className="text-sm">
              {new Date(e.date + "T00:00:00").toLocaleDateString("de-DE", {
                weekday: "short",
                day: "numeric",
                month: "numeric",
              })}
            </span>
            <div className="flex items-center gap-3">
              <span className="font-mono text-lg font-bold">{e.hours}h</span>
              <button
                onClick={async () => {
                  await deleteSleep(e.id);
                  router.refresh();
                }}
                className="text-[var(--text-faint)]"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
        {initialEntries.length === 0 && (
          <p className="text-sm text-[var(--text-faint)]">Noch keine Einträge.</p>
        )}
      </div>
    </div>
  );
}
