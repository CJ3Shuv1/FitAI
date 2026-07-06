"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { weekDates, weekRangeLabel, dateKeyLocal } from "@/lib/dates";
import { computeTargets, isProfileComplete } from "@/lib/types";
import type {
  NutritionEntry,
  NutritionRecipeEntry,
  Profile,
  Recipe,
  UserSettings,
} from "@/lib/types";
import { callAI, fetchNutritionFromApiNinjas, type Macros } from "@/lib/ai";
import {
  addRecipeToDay,
  removeRecipeFromDay,
  saveNutritionResult,
  saveNutritionText,
} from "./actions";

function emptyMacros(): Macros {
  return { kcal: 0, protein: 0, carbs: 0, fett: 0, zucker: 0 };
}

function dayTotals(entry: NutritionEntry | undefined, recipeEntries: NutritionRecipeEntry[]) {
  const base = emptyMacros();
  if (entry) {
    base.kcal += entry.kcal ?? 0;
    base.protein += entry.protein ?? 0;
    base.carbs += entry.carbs ?? 0;
    base.fett += entry.fett ?? 0;
    base.zucker += entry.zucker ?? 0;
  }
  recipeEntries.forEach((re) => {
    base.kcal += re.kcal ?? 0;
    base.protein += re.protein ?? 0;
    base.carbs += re.carbs ?? 0;
    base.fett += re.fett ?? 0;
    base.zucker += re.zucker ?? 0;
  });
  return base;
}

function hasData(entry: NutritionEntry | undefined, recipeEntries: NutritionRecipeEntry[]) {
  return !!(entry?.kcal || entry?.protein || recipeEntries.length > 0);
}

export default function NutritionBoard({
  initialEntries,
  initialRecipeEntries,
  recipes,
  profile,
  settings,
}: {
  initialEntries: NutritionEntry[];
  initialRecipeEntries: NutritionRecipeEntry[];
  recipes: Recipe[];
  profile: Profile | null;
  settings: UserSettings | null;
}) {
  const router = useRouter();
  const [weekOffset, setWeekOffset] = useState(0);
  const [view, setView] = useState<"day" | "week">("day");
  const [activeDate, setActiveDate] = useState(dateKeyLocal(new Date()));
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const dates = weekDates(weekOffset);

  const entryByDate = useMemo(() => {
    const map = new Map<string, NutritionEntry>();
    initialEntries.forEach((e) => map.set(e.date, e));
    return map;
  }, [initialEntries]);

  const recipeEntriesByDate = useMemo(() => {
    const map = new Map<string, NutritionRecipeEntry[]>();
    initialRecipeEntries.forEach((re) => {
      const list = map.get(re.date) || [];
      list.push(re);
      map.set(re.date, list);
    });
    return map;
  }, [initialRecipeEntries]);

  const activeEntry = entryByDate.get(activeDate);
  const activeRecipeEntries = recipeEntriesByDate.get(activeDate) || [];

  return (
    <div>
      <div className="mb-4 flex items-center gap-2">
        <button
          onClick={() => {
            setWeekOffset((w) => w - 1);
            setView("day");
            setActiveDate(weekDates(weekOffset - 1)[0].key);
          }}
          className="shrink-0 rounded-full border border-[var(--hairline)] px-1.5 py-2 text-[var(--text-faint)]"
        >
          ‹
        </button>
        <div className="flex min-w-0 flex-1 gap-1">
          {dates.map((d) => (
            <button
              key={d.key}
              onClick={() => {
                setActiveDate(d.key);
                setView("day");
              }}
              className={`flex min-w-0 flex-1 flex-col items-center gap-1 rounded-xl px-0.5 py-2 ${
                view === "day" && activeDate === d.key
                  ? "bg-[var(--surface-raised)] text-[var(--text)]"
                  : "text-[var(--text-faint)]"
              }`}
            >
              <span
                className={`h-1 w-1 rounded-full ${
                  hasData(entryByDate.get(d.key), recipeEntriesByDate.get(d.key) || [])
                    ? "bg-[var(--good)]"
                    : "bg-transparent"
                }`}
              />
              <span className="font-mono text-[10px] font-semibold uppercase">
                {d.label}
              </span>
            </button>
          ))}
        </div>
        <button
          onClick={() => setView("week")}
          className={`shrink-0 rounded-xl px-2 py-2 font-mono text-sm ${
            view === "week" ? "bg-[var(--surface-raised)] text-[var(--text)]" : "text-[var(--text-faint)]"
          }`}
        >
          ∑
        </button>
        <button
          onClick={() => {
            setWeekOffset((w) => w + 1);
            setView("day");
            setActiveDate(weekDates(weekOffset + 1)[0].key);
          }}
          className="shrink-0 rounded-full border border-[var(--hairline)] px-1.5 py-2 text-[var(--text-faint)]"
        >
          ›
        </button>
      </div>

      {view === "week" ? (
        <WeekSummary
          dates={dates}
          weekOffset={weekOffset}
          entryByDate={entryByDate}
          recipeEntriesByDate={recipeEntriesByDate}
        />
      ) : (
        <DayView
          key={activeDate}
          dateKey={activeDate}
          fullLabel={dates.find((d) => d.key === activeDate)?.full ?? activeDate}
          entry={activeEntry}
          recipeEntries={activeRecipeEntries}
          recipes={recipes}
          profile={profile}
          settings={settings}
          onSaved={() => router.refresh()}
          showToast={showToast}
        />
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full border border-[var(--hairline)] bg-[var(--surface-raised)] px-4 py-2.5 text-[12.5px]">
          {toast}
        </div>
      )}
    </div>
  );
}

function WeekSummary({
  dates,
  weekOffset,
  entryByDate,
  recipeEntriesByDate,
}: {
  dates: ReturnType<typeof weekDates>;
  weekOffset: number;
  entryByDate: Map<string, NutritionEntry>;
  recipeEntriesByDate: Map<string, NutritionRecipeEntry[]>;
}) {
  const total = emptyMacros();
  let daysWithData = 0;
  dates.forEach((d) => {
    const entry = entryByDate.get(d.key);
    const recipeEntries = recipeEntriesByDate.get(d.key) || [];
    if (hasData(entry, recipeEntries)) {
      daysWithData++;
      const t = dayTotals(entry, recipeEntries);
      total.kcal += t.kcal;
      total.protein += t.protein;
      total.carbs += t.carbs;
      total.fett += t.fett;
      total.zucker += t.zucker;
    }
  });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold uppercase tracking-tight">
        Σ {weekRangeLabel(weekOffset)}
      </h1>
      <p className="mb-4 text-sm text-[var(--text-dim)]">
        {weekOffset === 0 ? "Diese Woche" : weekOffset < 0 ? `${-weekOffset} Woche(n) zurück` : `${weekOffset} Woche(n) voraus`}
      </p>
      <table className="w-full border-collapse">
        <thead>
          <tr>
            <th className="border-b border-[var(--hairline)] py-1.5 text-left font-mono text-[9px] uppercase text-[var(--text-faint)]">Tag</th>
            <th className="border-b border-[var(--hairline)] py-1.5 text-right font-mono text-[9px] uppercase text-[var(--text-faint)]">Kcal</th>
            <th className="border-b border-[var(--hairline)] py-1.5 text-right font-mono text-[9px] uppercase text-[var(--text-faint)]">P</th>
            <th className="border-b border-[var(--hairline)] py-1.5 text-right font-mono text-[9px] uppercase text-[var(--text-faint)]">C</th>
            <th className="border-b border-[var(--hairline)] py-1.5 text-right font-mono text-[9px] uppercase text-[var(--text-faint)]">F</th>
          </tr>
        </thead>
        <tbody>
          {dates.map((d) => {
            const entry = entryByDate.get(d.key);
            const recipeEntries = recipeEntriesByDate.get(d.key) || [];
            const t = dayTotals(entry, recipeEntries);
            const empty = !hasData(entry, recipeEntries);
            return (
              <tr key={d.key} className={empty ? "text-[var(--text-faint)]" : ""}>
                <td className="border-b border-[var(--hairline)] py-2 font-semibold">{d.label}</td>
                <td className="border-b border-[var(--hairline)] py-2 text-right font-mono text-xs">{t.kcal}</td>
                <td className="border-b border-[var(--hairline)] py-2 text-right font-mono text-xs">{t.protein}</td>
                <td className="border-b border-[var(--hairline)] py-2 text-right font-mono text-xs">{t.carbs}</td>
                <td className="border-b border-[var(--hairline)] py-2 text-right font-mono text-xs">{t.fett}</td>
              </tr>
            );
          })}
          <tr className="font-bold text-[var(--copper)]">
            <td className="border-t border-[var(--hairline)] py-2">Σ</td>
            <td className="border-t border-[var(--hairline)] py-2 text-right font-mono text-xs">{total.kcal}</td>
            <td className="border-t border-[var(--hairline)] py-2 text-right font-mono text-xs">{total.protein}</td>
            <td className="border-t border-[var(--hairline)] py-2 text-right font-mono text-xs">{total.carbs}</td>
            <td className="border-t border-[var(--hairline)] py-2 text-right font-mono text-xs">{total.fett}</td>
          </tr>
          <tr className="italic text-[var(--steel)]">
            <td className="py-2">Ø/Tag</td>
            <td className="py-2 text-right font-mono text-xs">{daysWithData ? Math.round(total.kcal / daysWithData) : 0}</td>
            <td className="py-2 text-right font-mono text-xs">{daysWithData ? Math.round(total.protein / daysWithData) : 0}</td>
            <td className="py-2 text-right font-mono text-xs">{daysWithData ? Math.round(total.carbs / daysWithData) : 0}</td>
            <td className="py-2 text-right font-mono text-xs">{daysWithData ? Math.round(total.fett / daysWithData) : 0}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

function DayView({
  dateKey,
  fullLabel,
  entry,
  recipeEntries,
  recipes,
  profile,
  settings,
  onSaved,
  showToast,
}: {
  dateKey: string;
  fullLabel: string;
  entry: NutritionEntry | undefined;
  recipeEntries: NutritionRecipeEntry[];
  recipes: Recipe[];
  profile: Profile | null;
  settings: UserSettings | null;
  onSaved: () => void;
  showToast: (msg: string) => void;
}) {
  const [text, setText] = useState(entry?.text ?? "");
  const [result, setResult] = useState<Macros | null>(
    entry?.kcal != null
      ? {
          kcal: entry.kcal ?? 0,
          protein: entry.protein ?? 0,
          carbs: entry.carbs ?? 0,
          fett: entry.fett ?? 0,
          zucker: entry.zucker ?? 0,
        }
      : null
  );
  const [loading, setLoading] = useState(false);
  const [showRecipePicker, setShowRecipePicker] = useState(false);

  async function analyze() {
    if (!text.trim()) {
      showToast("Bitte zuerst eintragen, was du gegessen hast");
      return;
    }
    if (!settings) {
      showToast("Bitte zuerst in den Einstellungen einen API-Key hinterlegen");
      return;
    }

    setLoading(true);
    try {
      let macros: Macros;
      if (settings.nutrition_method === "apininjas") {
        macros = await fetchNutritionFromApiNinjas(settings.api_ninjas_key ?? "", text);
      } else {
        const key = settings.ai_provider === "gemini" ? settings.gemini_key : settings.groq_key;
        if (!key) {
          showToast("Bitte zuerst API-Key in den Einstellungen eintragen");
          setLoading(false);
          return;
        }
        const goalLabel = profile?.goal
          ? { bulk: "Kalorienüberschuss (Bulk)", cut: "Kaloriendefizit (Cut)", maintenance: "Erhaltung (Maintenance)" }[profile.goal]
          : "unbekannt";
        const profileLine = profile && isProfileComplete(profile)
          ? `Person: ${profile.age} Jahre, ${profile.height}cm, ${profile.weight}kg, trainiert Kraftsport, aktuelle Phase: ${goalLabel}. Berücksichtige das bei der Einschätzung üblicher Portionsgrößen.`
          : "Kein Nutzerprofil hinterlegt — schätze mit allgemein üblichen Portionsgrößen.";
        const systemPrompt =
          'Du bist ein präziser Ernährungsanalyst. Der Nutzer beschreibt, was er an einem Tag gegessen hat (auf Deutsch, oft stichpunktartig mit Mengenangaben). ' +
          profileLine +
          ' Schätze realistische Nährwerte basierend auf den genannten Lebensmitteln und Mengen. Antworte AUSSCHLIESSLICH mit einem JSON-Objekt mit genau diesen Feldern, alle als Zahlen: {"kcal": number, "protein": number, "carbs": number, "fett": number, "zucker": number}. protein, carbs, fett und zucker sind in Gramm.';
        const content = await callAI(settings.ai_provider, key, systemPrompt, text, { json: true });
        const parsed = JSON.parse(content);
        const num = (v: unknown) => {
          const n = parseFloat(String(v));
          return Number.isNaN(n) ? 0 : Math.round(n);
        };
        macros = {
          kcal: num(parsed.kcal),
          protein: num(parsed.protein),
          carbs: num(parsed.carbs),
          fett: num(parsed.fett),
          zucker: num(parsed.zucker),
        };
      }
      setResult(macros);
      await saveNutritionText(dateKey, text);
      await saveNutritionResult(dateKey, macros);
      showToast("Analyse abgeschlossen");
      onSaved();
    } catch (err) {
      showToast("Analyse fehlgeschlagen: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  const combinedTotals = dayTotals(
    result
      ? { ...(entry ?? ({} as NutritionEntry)), ...result, id: "", user_id: "", date: dateKey, text }
      : entry,
    recipeEntries
  );

  return (
    <div>
      <h1 className="mb-1 text-2xl font-extrabold tracking-tight">{fullLabel}</h1>
      <p className="mb-4 text-sm text-[var(--text-dim)]">Was hast du gegessen?</p>

      <div className="mb-3 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-1">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={() => saveNutritionText(dateKey, text)}
          placeholder="z.B. 200g Hähnchenbrust, 150g Reis, 1 EL Olivenöl, 1 Apfel, 2 Eier..."
          className="min-h-[110px] w-full resize-y bg-transparent p-3 text-sm outline-none"
        />
      </div>

      <button
        onClick={analyze}
        disabled={loading}
        className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--copper)] p-3.5 text-sm font-bold text-[#1A1209] disabled:opacity-60"
      >
        {loading ? "Analysiere…" : result ? "🔄 Neu analysieren" : "🤖 Analysieren"}
      </button>

      {result && (
        <div className="mb-5 grid grid-cols-2 gap-2">
          {(
            [
              ["kcal", "Kalorien", "kcal"],
              ["protein", "Protein", "g"],
              ["carbs", "Carbs", "g"],
              ["fett", "Fett", "g"],
              ["zucker", "Zucker", "g"],
            ] as const
          ).map(([key, label, unit]) => (
            <div key={key} className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5">
              <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                {label}
              </div>
              <input
                type="number"
                value={result[key]}
                onChange={(e) =>
                  setResult((r) => (r ? { ...r, [key]: parseFloat(e.target.value) || 0 } : r))
                }
                onBlur={async () => {
                  if (result) {
                    await saveNutritionResult(dateKey, result);
                    onSaved();
                  }
                }}
                className="w-full bg-transparent font-mono text-lg font-bold outline-none"
              />
              <span className="text-[11px] text-[var(--text-faint)]">{unit}</span>
            </div>
          ))}
        </div>
      )}

      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
        Aus Rezepten
      </div>
      {recipeEntries.map((re) => {
        const recipe = recipes.find((r) => r.id === re.recipe_id);
        return (
          <div
            key={re.id}
            className="mb-2 flex items-center gap-3 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3"
          >
            <div className="flex-1 text-sm">
              {recipe?.title ?? "Rezept"}{" "}
              <span className="text-[var(--text-faint)]">×{re.qty}</span>
            </div>
            <div className="font-mono text-xs text-[var(--steel)]">
              {re.kcal} kcal · {re.protein}g P
            </div>
            <button
              onClick={async () => {
                await removeRecipeFromDay(re.id);
                onSaved();
              }}
              className="text-[var(--text-faint)]"
            >
              ✕
            </button>
          </div>
        );
      })}

      {recipes.length === 0 ? (
        <p className="mb-4 text-[11.5px] text-[var(--text-faint)]">
          Noch keine gespeicherten Rezepte. Im 🍳-Tab ein Rezept erstellen, dann hier auswählbar.
        </p>
      ) : (
        <button
          onClick={() => setShowRecipePicker(true)}
          className="mb-4 w-full rounded-2xl border border-dashed border-[var(--hairline)] p-3 text-sm text-[var(--text-faint)]"
        >
          + Rezept hinzufügen
        </button>
      )}

      {profile && isProfileComplete(profile) && (combinedTotals.kcal > 0 || recipeEntries.length > 0) && (
        <NeedComparison profile={profile} totals={combinedTotals} />
      )}

      {showRecipePicker && (
        <RecipePickerModal
          recipes={recipes}
          onClose={() => setShowRecipePicker(false)}
          onConfirm={async (recipeId, qty) => {
            const recipe = recipes.find((r) => r.id === recipeId);
            if (!recipe) return;
            const macros: Macros = {
              kcal: Math.round((recipe.kcal_per_serving ?? 0) * qty),
              protein: Math.round((recipe.protein_per_serving ?? 0) * qty),
              carbs: Math.round((recipe.carbs_per_serving ?? 0) * qty),
              fett: Math.round((recipe.fett_per_serving ?? 0) * qty),
              zucker: Math.round((recipe.zucker_per_serving ?? 0) * qty),
            };
            await addRecipeToDay(dateKey, recipeId, qty, macros);
            setShowRecipePicker(false);
            onSaved();
            showToast("Zu diesem Tag hinzugefügt");
          }}
        />
      )}
    </div>
  );
}

function NeedComparison({
  profile,
  totals,
}: {
  profile: NonNullable<Profile>;
  totals: Macros;
}) {
  if (!isProfileComplete(profile)) return null;
  const t = computeTargets(profile);
  const rows: [keyof Macros, string, number, string][] = [
    ["kcal", "Kalorien", t.kcal, "kcal"],
    ["protein", "Protein", t.protein, "g"],
    ["carbs", "Carbs", t.carbs, "g"],
    ["fett", "Fett", t.fett, "g"],
  ];

  return (
    <div>
      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
        Bedarfs-Abgleich ({t.kcal} kcal ·{" "}
        {{ bulk: "Bulk", cut: "Cut", maintenance: "Maintenance" }[profile.goal!]})
      </div>
      {rows.map(([key, label, target, unit]) => {
        const val = totals[key] || 0;
        const pct = target > 0 ? Math.round((val / target) * 100) : 0;
        return (
          <div key={key} className="mt-2.5">
            <div className="mb-1 flex justify-between font-mono text-[11px] text-[var(--text-dim)]">
              <span>{label}</span>
              <span>
                <b className="text-[var(--text)]">{val}</b> / {target}
                {unit} · {pct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-[var(--surface-raised)]">
              <div
                className={`h-full rounded ${pct > 115 ? "bg-[#B5453A]" : "bg-[var(--copper)]"}`}
                style={{ width: Math.min(pct, 100) + "%" }}
              />
            </div>
          </div>
        );
      })}
      {(() => {
        const sugarVal = totals.zucker || 0;
        const sugarPct = t.zucker > 0 ? Math.round((sugarVal / t.zucker) * 100) : 0;
        return (
          <div className="mt-2.5">
            <div className="mb-1 flex justify-between font-mono text-[11px] text-[var(--text-dim)]">
              <span>Zucker (Limit)</span>
              <span>
                <b className="text-[var(--text)]">{sugarVal}</b> / {t.zucker}g · {sugarPct}%
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded bg-[var(--surface-raised)]">
              <div
                className={`h-full rounded ${sugarPct > 100 ? "bg-[#B5453A]" : "bg-[var(--good)]"}`}
                style={{ width: Math.min(sugarPct, 100) + "%" }}
              />
            </div>
          </div>
        );
      })()}
    </div>
  );
}

function RecipePickerModal({
  recipes,
  onClose,
  onConfirm,
}: {
  recipes: Recipe[];
  onClose: () => void;
  onConfirm: (recipeId: string, qty: number) => void;
}) {
  const [recipeId, setRecipeId] = useState(recipes[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const recipe = recipes.find((r) => r.id === recipeId);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      <div className="w-full max-w-[560px] rounded-t-2xl border border-[var(--hairline)] bg-[var(--surface-raised)] p-5">
        <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--steel)]">
          🍳 Rezept hinzufügen
        </div>
        <div className="mb-4 text-base font-bold">Wie viel hast du gegessen?</div>

        <label className="mb-3 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            Rezept
          </span>
          <select
            value={recipeId}
            onChange={(e) => setRecipeId(e.target.value)}
            className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm"
          >
            {recipes.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title} ({r.kcal_per_serving}kcal/Portion)
              </option>
            ))}
          </select>
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            Menge (Portionen)
          </span>
          <input
            type="number"
            step={0.5}
            min={0.5}
            value={qty}
            onChange={(e) => setQty(parseFloat(e.target.value) || 1)}
            className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-3 text-sm"
          />
        </label>

        {recipe && (
          <p className="mb-4 text-[11.5px] text-[var(--text-faint)]">
            ≈ {Math.round((recipe.kcal_per_serving ?? 0) * qty)}kcal ·{" "}
            {Math.round((recipe.protein_per_serving ?? 0) * qty)}g Protein ·{" "}
            {Math.round((recipe.carbs_per_serving ?? 0) * qty)}g Carbs ·{" "}
            {Math.round((recipe.fett_per_serving ?? 0) * qty)}g Fett
          </p>
        )}

        <div className="flex gap-2.5">
          <button onClick={onClose} className="flex-1 rounded-xl py-3.5 text-sm font-semibold text-[var(--text-dim)]">
            Abbrechen
          </button>
          <button
            onClick={() => recipeId && onConfirm(recipeId, qty)}
            className="flex-1 rounded-xl bg-[var(--copper)] py-3.5 text-sm font-semibold text-[#1A1209]"
          >
            Hinzufügen
          </button>
        </div>
      </div>
    </div>
  );
}
