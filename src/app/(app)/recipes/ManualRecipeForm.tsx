"use client";

import { useState } from "react";
import type { Food, Recipe, UserSettings } from "@/lib/types";
import { UNIT_OPTIONS, computeMacrosForRow, findFoodMatch, sumMacros, type Unit } from "@/lib/foodMatch";
import { callAI } from "@/lib/ai";
import { createRecipe } from "./actions";
import AddFoodModal from "./AddFoodModal";

type Row = { id: string; name: string; amount: string; unit: Unit };

let rowId = 0;
const newRowId = () => "row" + rowId++;

const NEW_FOOD_VALUE = "__new_food__";
const CUSTOM_VALUE = "__custom__";

export default function ManualRecipeForm({
  foods: initialFoods,
  settings,
  onSaved,
  showToast,
}: {
  foods: Food[];
  settings: UserSettings | null;
  onSaved: () => void;
  showToast: (msg: string) => void;
}) {
  const [foods, setFoods] = useState(initialFoods);
  const [title, setTitle] = useState("");
  const [rows, setRows] = useState<Row[]>([{ id: newRowId(), name: "", amount: "", unit: "g" }]);
  const [batchPortions, setBatchPortions] = useState(1);
  const [steps, setSteps] = useState("");
  const [macros, setMacros] = useState({ kcal: 0, protein: 0, carbs: 0, fett: 0, zucker: 0 });
  const [calculating, setCalculating] = useState(false);
  const [addFoodForRow, setAddFoodForRow] = useState<string | null>(null);

  function updateRow(id: string, patch: Partial<Row>) {
    setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function pickFoodForRow(rowId: string, value: string) {
    if (value === NEW_FOOD_VALUE) {
      setAddFoodForRow(rowId);
      return;
    }
    if (value === CUSTOM_VALUE) return;
    const food = foods.find((f) => f.id === value);
    if (food) {
      updateRow(rowId, {
        name: food.name,
        unit: food.default_unit === "Stück" ? "Stück" : food.default_unit,
      });
    }
  }

  async function calculate() {
    setCalculating(true);
    try {
      const validRows = rows.filter((r) => r.name.trim() && r.amount);
      if (validRows.length === 0) {
        showToast("Bitte mindestens eine Zutat mit Menge eintragen");
        return;
      }

      const matched: ReturnType<typeof computeMacrosForRow>[] = [];
      const unmatched: Row[] = [];

      validRows.forEach((r) => {
        const food = findFoodMatch(r.name, foods);
        const amount = parseFloat(r.amount);
        const result = food ? computeMacrosForRow(food, amount, r.unit) : null;
        if (result) {
          matched.push(result);
        } else {
          unmatched.push(r);
        }
      });

      let aiTotal = { kcal: 0, protein: 0, carbs: 0, fett: 0, zucker: 0 };
      if (unmatched.length > 0) {
        const key = settings?.ai_provider === "gemini" ? settings?.gemini_key : settings?.groq_key;
        if (!settings || !key) {
          showToast(
            `${unmatched.length} Zutat(en) nicht in der Lebensmittel-Liste gefunden — bitte API-Key hinterlegen oder Werte manuell eintragen: ${unmatched.map((r) => r.name).join(", ")}`
          );
        } else {
          const text = unmatched.map((r) => `${r.amount}${r.unit} ${r.name}`).join(", ");
          const systemPrompt =
            'Du bist ein präziser Ernährungsanalyst. Der Nutzer nennt die GESAMTMENGE mehrerer Zutaten. Berechne die Nährwerte für die GESAMTE genannte Menge. Antworte AUSSCHLIESSLICH als JSON: {"kcal": number, "protein": number, "carbs": number, "fett": number, "zucker": number}. protein, carbs, fett, zucker in Gramm.';
          const content = await callAI(settings.ai_provider, key, systemPrompt, text, { json: true });
          const parsed = JSON.parse(content);
          const num = (v: unknown) => {
            const n = parseFloat(String(v));
            return Number.isNaN(n) ? 0 : n;
          };
          aiTotal = {
            kcal: num(parsed.kcal),
            protein: num(parsed.protein),
            carbs: num(parsed.carbs),
            fett: num(parsed.fett),
            zucker: num(parsed.zucker),
          };
        }
      }

      const matchedTotal = sumMacros(matched.filter((m): m is NonNullable<typeof m> => m !== null));
      const combined = sumMacros([matchedTotal, aiTotal]);
      const portions = Math.max(1, batchPortions);

      setMacros({
        kcal: Math.round(combined.kcal / portions),
        protein: Math.round((combined.protein / portions) * 10) / 10,
        carbs: Math.round((combined.carbs / portions) * 10) / 10,
        fett: Math.round((combined.fett / portions) * 10) / 10,
        zucker: Math.round((combined.zucker / portions) * 10) / 10,
      });

      if (unmatched.length === 0) {
        showToast("Werte aus Lebensmittel-Liste berechnet — kein KI-Aufruf nötig");
      }
    } catch (err) {
      showToast("Berechnung fehlgeschlagen: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setCalculating(false);
    }
  }

  return (
    <div>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Titel (z.B. Omas Linsensuppe)"
        className="mb-3 w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-3 text-sm outline-none focus:border-[var(--copper)]"
      />

      <div className="mb-3 flex items-center justify-center gap-2.5 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5">
        <span className="text-[12.5px] text-[var(--text-dim)]">Reicht für</span>
        <input
          type="number"
          min={1}
          value={batchPortions}
          onChange={(e) => setBatchPortions(parseInt(e.target.value, 10) || 1)}
          className="w-14 shrink-0 rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2 text-center text-sm"
        />
        <span className="text-[12.5px] text-[var(--text-dim)]">Portionen</span>
      </div>
      <p className="mb-3 text-[11.5px] text-[var(--text-faint)]">
        {batchPortions > 1
          ? `Trag unten die GESAMTMENGE ein (für alle ${batchPortions} Portionen zusammen) — die Berechnung rechnet automatisch pro Portion runter.`
          : "Bei 1 Portion gelten die Mengen unten direkt für 1 Portion."}
      </p>

      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
        Zutaten
      </div>
      {rows.map((row) => (
        <div key={row.id} className="mb-2 rounded-xl border border-[var(--hairline)] bg-[var(--surface)] p-2.5">
          <select
            value=""
            onChange={(e) => {
              pickFoodForRow(row.id, e.target.value);
              e.target.value = "";
            }}
            className="mb-2 w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2 font-mono text-[11px] uppercase tracking-[0.05em] text-[var(--text-faint)]"
          >
            <option value="">🥑 aus Lebensmittel-Liste wählen…</option>
            {foods.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
            <option value={NEW_FOOD_VALUE}>+ Neues Lebensmittel hinzufügen</option>
          </select>
          <input
            value={row.name}
            onChange={(e) => updateRow(row.id, { name: e.target.value })}
            placeholder="Zutat (z.B. Hähnchenbrust) — oder oben auswählen"
            className="mb-2 w-full border-b border-[var(--hairline)] bg-transparent pb-1.5 text-sm outline-none focus:border-[var(--copper)]"
          />
          <div className="flex items-center gap-2">
            <input
              type="number"
              value={row.amount}
              onChange={(e) => updateRow(row.id, { amount: e.target.value })}
              placeholder="Menge"
              className="min-w-0 flex-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2 text-sm"
            />
            <select
              value={row.unit}
              onChange={(e) => updateRow(row.id, { unit: e.target.value as Unit })}
              className="min-w-0 flex-1 rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2 text-sm"
            >
              {UNIT_OPTIONS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
            </select>
            <button
              onClick={() => setRows((rs) => rs.filter((r) => r.id !== row.id))}
              className="shrink-0 text-[var(--text-faint)]"
            >
              ✕
            </button>
          </div>
        </div>
      ))}

      <button
        onClick={() => setRows((rs) => [...rs, { id: newRowId(), name: "", amount: "", unit: "g" }])}
        className="mb-3 w-full rounded-xl border border-dashed border-[var(--hairline)] p-3 text-sm text-[var(--text-faint)]"
      >
        + Zutat hinzufügen
      </button>

      <button
        onClick={calculate}
        disabled={calculating}
        className="mb-4 w-full rounded-2xl border border-[var(--hairline)] bg-[var(--surface-raised)] p-3 text-sm font-bold disabled:opacity-60"
      >
        {calculating ? "Berechne…" : "🧮 Werte übernehmen"}
      </button>

      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
        Nährwerte pro 1 Portion
      </div>
      <div className="mb-4 grid grid-cols-2 gap-2">
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
              value={macros[key]}
              onChange={(e) => setMacros((m) => ({ ...m, [key]: parseFloat(e.target.value) || 0 }))}
              className="w-full bg-transparent font-mono text-lg font-bold outline-none"
            />
            <span className="text-[11px] text-[var(--text-faint)]">{unit}</span>
          </div>
        ))}
      </div>

      <div className="mb-2 font-mono text-[11px] uppercase tracking-[0.12em] text-[var(--text-faint)]">
        Zubereitung (optional, ein Schritt pro Zeile)
      </div>
      <textarea
        value={steps}
        onChange={(e) => setSteps(e.target.value)}
        placeholder={"Zutaten vorbereiten...\nIn der Pfanne anbraten..."}
        className="mb-4 min-h-[80px] w-full rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-3 text-sm outline-none focus:border-[var(--copper)]"
      />

      <button
        onClick={async () => {
          if (!title.trim()) {
            showToast("Bitte einen Titel eintragen");
            return;
          }
          const recipe: Omit<Recipe, "id" | "user_id"> = {
            title: title.trim(),
            kcal_per_serving: macros.kcal,
            protein_per_serving: macros.protein,
            carbs_per_serving: macros.carbs,
            fett_per_serving: macros.fett,
            zucker_per_serving: macros.zucker,
            image_url: null,
            cook_time_minutes: null,
            difficulty: null,
            ingredients: rows
              .filter((r) => r.name.trim())
              .map((r) => ({ name: r.name.trim(), amount: r.amount, unit: r.unit })),
            steps: steps.trim() ? steps.trim().split("\n").map((s) => s.trim()).filter(Boolean) : [],
          };
          await createRecipe(recipe);
          setTitle("");
          setRows([{ id: newRowId(), name: "", amount: "", unit: "g" }]);
          setSteps("");
          setMacros({ kcal: 0, protein: 0, carbs: 0, fett: 0, zucker: 0 });
          onSaved();
          showToast("Rezept gespeichert");
        }}
        className="w-full rounded-2xl bg-[var(--copper)] py-3.5 text-sm font-bold text-[#1A1209]"
      >
        💾 Rezept speichern
      </button>

      {addFoodForRow && (
        <AddFoodModal
          onClose={() => setAddFoodForRow(null)}
          onSaved={(food) => {
            const rowId = addFoodForRow;
            setAddFoodForRow(null);
            setFoods((fs) => [...fs, food]);
            updateRow(rowId, {
              name: food.name,
              unit: food.default_unit === "Stück" ? "Stück" : food.default_unit,
            });
            showToast("Lebensmittel gespeichert");
          }}
        />
      )}
    </div>
  );
}
