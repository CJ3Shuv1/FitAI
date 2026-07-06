"use client";

import { useState } from "react";
import type { Food } from "@/lib/types";
import { createFood } from "./foodActions";

export default function AddFoodModal({
  onClose,
  onSaved,
}: {
  onClose: () => void;
  onSaved: (food: Food) => void;
}) {
  const [name, setName] = useState("");
  const [unit, setUnit] = useState<"g" | "ml" | "Stück">("g");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fett, setFett] = useState("");
  const [zucker, setZucker] = useState("");
  const [pieceWeight, setPieceWeight] = useState("");

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70">
      <div className="max-h-[85vh] w-full max-w-[560px] overflow-y-auto rounded-t-2xl border border-[var(--hairline)] bg-[var(--surface-raised)] p-5">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-[0.12em] text-[var(--steel)]">
          🥑 Neu in der Lebensmittel-Liste
        </div>
        <div className="mb-4 text-base font-bold">Eigenes Lebensmittel</div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Name (z.B. Skyr)"
          className="mb-3 w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-3 text-sm outline-none focus:border-[var(--copper)]"
        />

        <label className="mb-3 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            Einheit
          </span>
          <select
            value={unit}
            onChange={(e) => setUnit(e.target.value as typeof unit)}
            className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm"
          >
            <option value="g">Gramm (Werte pro 100g)</option>
            <option value="ml">Milliliter (Werte pro 100ml)</option>
            <option value="Stück">Stück (mit Ø-Gewicht)</option>
          </select>
        </label>

        {unit === "Stück" && (
          <input
            type="number"
            value={pieceWeight}
            onChange={(e) => setPieceWeight(e.target.value)}
            placeholder="Ø Gewicht pro Stück in g (z.B. 120)"
            className="mb-3 w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-3 text-sm outline-none focus:border-[var(--copper)]"
          />
        )}

        <div className="mb-4 grid grid-cols-2 gap-2">
          <NumField label="Kalorien" unit="kcal/100" value={kcal} onChange={setKcal} />
          <NumField label="Protein" unit="g/100" value={protein} onChange={setProtein} />
          <NumField label="Carbs" unit="g/100" value={carbs} onChange={setCarbs} />
          <NumField label="Fett" unit="g/100" value={fett} onChange={setFett} />
          <NumField label="Zucker" unit="g/100" value={zucker} onChange={setZucker} />
        </div>

        <div className="flex gap-2.5">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl py-3.5 text-sm font-semibold text-[var(--text-dim)]"
          >
            Abbrechen
          </button>
          <button
            onClick={async () => {
              if (!name.trim()) return;
              const created = await createFood({
                name: name.trim(),
                kcal_per_100g: parseFloat(kcal) || 0,
                protein_per_100g: parseFloat(protein) || 0,
                carbs_per_100g: parseFloat(carbs) || 0,
                fett_per_100g: parseFloat(fett) || 0,
                zucker_per_100g: parseFloat(zucker) || 0,
                default_unit: unit,
                piece_weight_g: unit === "Stück" ? parseFloat(pieceWeight) || null : null,
              });
              if (created) onSaved(created);
            }}
            className="flex-1 rounded-xl bg-[var(--copper)] py-3.5 text-sm font-semibold text-[#1A1209]"
          >
            Speichern
          </button>
        </div>
      </div>
    </div>
  );
}

function NumField({
  label,
  unit,
  value,
  onChange,
}: {
  label: string;
  unit: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5">
      <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
        {label}
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-transparent font-mono text-lg font-bold outline-none"
      />
      <span className="text-[11px] text-[var(--text-faint)]">{unit}</span>
    </div>
  );
}
