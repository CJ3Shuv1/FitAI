"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { Profile, UserSettings, Goal } from "@/lib/types";
import { computeTargets, PHASE_DEFAULTS } from "@/lib/types";
import { THEMES, THEME_LABELS, type ThemeName } from "@/lib/themes";
import {
  exportProfileJson,
  importProfileJson,
  saveAISettings,
  saveProfile,
  saveTheme,
} from "./actions";
export default function SettingsForm({
  profile,
  settings,
}: {
  profile: Profile | null;
  settings: UserSettings | null;
}) {
  const router = useRouter();
  const importInputRef = useRef<HTMLInputElement>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [theme, setTheme] = useState<ThemeName>(settings?.theme ?? "copper");

  const [weight, setWeight] = useState(profile?.weight?.toString() ?? "");
  const [height, setHeight] = useState(profile?.height?.toString() ?? "");
  const [age, setAge] = useState(profile?.age?.toString() ?? "");
  const [goal, setGoal] = useState<Goal | "">(profile?.goal ?? "");
  const [activityFactor, setActivityFactor] = useState(
    profile?.activity_factor?.toString() ?? ""
  );
  const [proteinPerKg, setProteinPerKg] = useState(
    profile?.protein_per_kg?.toString() ?? ""
  );
  const [fatPercent, setFatPercent] = useState(
    profile?.fat_percent?.toString() ?? ""
  );
  const [kcalAdjust, setKcalAdjust] = useState(
    profile?.kcal_adjust?.toString() ?? ""
  );
  const [sugarPercent, setSugarPercent] = useState(
    profile?.sugar_percent?.toString() ?? ""
  );

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const preview = useMemo(() => {
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseFloat(age);
    const af = parseFloat(activityFactor);
    const ppk = parseFloat(proteinPerKg);
    const fp = parseFloat(fatPercent);
    const ka = parseFloat(kcalAdjust);
    const sp = parseFloat(sugarPercent);
    if ([w, h, a, af, ppk, fp, ka, sp].some((n) => Number.isNaN(n))) return null;
    return computeTargets({
      weight: w,
      height: h,
      age: a,
      activity_factor: af,
      protein_per_kg: ppk,
      fat_percent: fp,
      kcal_adjust: ka,
      sugar_percent: sp,
    });
  }, [weight, height, age, activityFactor, proteinPerKg, fatPercent, kcalAdjust, sugarPercent]);

  return (
    <div>
      <h1 className="mb-1 text-3xl font-extrabold uppercase tracking-tight">
        Profil
      </h1>
      <p className="mb-6 text-sm text-[var(--text-dim)]">
        Deine Werte, deine KI-Keys, dein Look.
      </p>

      <form
        action={async (formData) => {
          await saveProfile(formData);
          showToast("Profil gespeichert");
          router.refresh();
        }}
        className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4"
      >
        <div className="mb-3 text-base font-bold">Mein Profil</div>
        <p className="mb-4 text-[11.5px] text-[var(--text-faint)]">
          Wird für Kalorien-/Makro-Ziele und Portionsschätzungen genutzt. Leer
          lassen, bis du deine Werte einträgst — es gibt keine Standardwerte.
        </p>

        <div className="mb-3 grid grid-cols-3 gap-2">
          <Field label="Gewicht" unit="kg">
            <input
              name="weight"
              type="number"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              className="w-full bg-transparent font-mono text-lg font-bold outline-none"
            />
          </Field>
          <Field label="Größe" unit="cm">
            <input
              name="height"
              type="number"
              value={height}
              onChange={(e) => setHeight(e.target.value)}
              className="w-full bg-transparent font-mono text-lg font-bold outline-none"
            />
          </Field>
          <Field label="Alter" unit="Jahre">
            <input
              name="age"
              type="number"
              value={age}
              onChange={(e) => setAge(e.target.value)}
              className="w-full bg-transparent font-mono text-lg font-bold outline-none"
            />
          </Field>
        </div>

        <label className="mb-3 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            Phase
          </span>
          <select
            name="goal"
            value={goal}
            onChange={(e) => {
              const g = e.target.value as Goal;
              setGoal(g);
              const d = PHASE_DEFAULTS[g];
              if (d) {
                setProteinPerKg(String(d.protein_per_kg));
                setKcalAdjust(String(d.kcal_adjust));
              }
            }}
            className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2.5 text-sm"
          >
            <option value="">– auswählen –</option>
            <option value="bulk">Bulk</option>
            <option value="cut">Cut</option>
            <option value="maintenance">Maintenance</option>
          </select>
        </label>

        <label className="mb-3 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            Aktivitätslevel
          </span>
          <select
            name="activity_factor"
            value={activityFactor}
            onChange={(e) => setActivityFactor(e.target.value)}
            className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2.5 text-sm"
          >
            <option value="">– auswählen –</option>
            <option value="1.2">Sitzend</option>
            <option value="1.375">Leicht aktiv</option>
            <option value="1.55">Aktiv (3–5x Training/Woche)</option>
            <option value="1.65">Sehr aktiv (4x+ intensives Krafttraining)</option>
            <option value="1.9">Extrem aktiv</option>
          </select>
        </label>

        <div className="mb-4 grid grid-cols-2 gap-2">
          <Field label="Protein/kg" unit="g/kg">
            <input
              name="protein_per_kg"
              type="number"
              step="0.1"
              value={proteinPerKg}
              onChange={(e) => setProteinPerKg(e.target.value)}
              className="w-full bg-transparent font-mono text-lg font-bold outline-none"
            />
          </Field>
          <Field label="Fett-Anteil" unit="% kcal">
            <input
              name="fat_percent"
              type="number"
              value={fatPercent}
              onChange={(e) => setFatPercent(e.target.value)}
              className="w-full bg-transparent font-mono text-lg font-bold outline-none"
            />
          </Field>
          <Field label="Kcal-Anpassung" unit="kcal ±">
            <input
              name="kcal_adjust"
              type="number"
              value={kcalAdjust}
              onChange={(e) => setKcalAdjust(e.target.value)}
              className="w-full bg-transparent font-mono text-lg font-bold outline-none"
            />
          </Field>
          <Field label="Zucker-Limit" unit="% kcal">
            <input
              name="sugar_percent"
              type="number"
              value={sugarPercent}
              onChange={(e) => setSugarPercent(e.target.value)}
              className="w-full bg-transparent font-mono text-lg font-bold outline-none"
            />
          </Field>
        </div>

        {preview && (
          <div className="mb-4 rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-3 text-[11.5px] text-[var(--text-faint)]">
            Berechnet: <b className="text-[var(--text)]">{preview.kcal} kcal</b> ·{" "}
            <b className="text-[var(--text)]">{preview.protein}g</b> Protein ·{" "}
            {preview.carbs}g Carbs · {preview.fett}g Fett · ≤{preview.zucker}g
            Zucker
          </div>
        )}

        <button
          type="submit"
          className="w-full rounded-xl bg-[var(--copper)] py-3 text-sm font-bold text-[#1A1209]"
        >
          Profil speichern
        </button>
      </form>

      <div className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
        <div className="mb-1 text-base font-bold">Erscheinungsbild</div>
        <p className="mb-4 text-[11.5px] text-[var(--text-faint)]">
          Wähl dein Farbschema — nur für dich, wirkt sich sofort überall aus.
        </p>
        <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-5">
          {(Object.keys(THEMES) as ThemeName[]).map((t) => {
            const colors = THEMES[t];
            return (
              <button
                key={t}
                onClick={async () => {
                  setTheme(t);
                  await saveTheme(t);
                  router.refresh();
                }}
                className={`flex flex-col items-center gap-1.5 rounded-xl border p-2 ${
                  theme === t ? "border-[var(--copper)]" : "border-[var(--hairline)]"
                }`}
                style={{ background: colors.surfaceRaised }}
              >
                <span
                  className="h-7 w-7 rounded-full border"
                  style={{ background: colors.accent, borderColor: colors.accentDim }}
                />
                <span className="font-mono text-[10px] font-semibold" style={{ color: colors.text }}>
                  {THEME_LABELS[t]}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <form
        action={async (formData) => {
          await saveAISettings(formData);
          showToast("KI-Einstellungen gespeichert");
          router.refresh();
        }}
        className="mb-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4"
      >
        <div className="mb-1 text-base font-bold">KI-Anbieter</div>
        <p className="mb-4 text-[11.5px] text-[var(--text-faint)]">
          Wird für Ernährungsanalyse, Rezepte und Plan-Upload genutzt.
        </p>

        <label className="mb-3 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            Aktiver Anbieter
          </span>
          <select
            name="ai_provider"
            defaultValue={settings?.ai_provider ?? "gemini"}
            className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2.5 text-sm"
          >
            <option value="groq">Groq (llama-3.3-70b)</option>
            <option value="gemini">Google Gemini (gemini-2.5-flash)</option>
          </select>
        </label>

        <KeyField label="Groq API-Key" name="groq_key" defaultValue={settings?.groq_key} placeholder="gsk_..." />
        <KeyField label="Gemini API-Key" name="gemini_key" defaultValue={settings?.gemini_key} placeholder="AIza..." />
        <KeyField label="Pexels API-Key" name="pexels_key" defaultValue={settings?.pexels_key} placeholder="563492ad..." />
        <KeyField label="API Ninjas Key" name="api_ninjas_key" defaultValue={settings?.api_ninjas_key} placeholder="dein Key..." />

        <label className="mb-4 block">
          <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
            Ernährungs-Analyse-Methode
          </span>
          <select
            name="nutrition_method"
            defaultValue={settings?.nutrition_method ?? "ai"}
            className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2.5 text-sm"
          >
            <option value="ai">KI (Gemini/Groq)</option>
            <option value="apininjas">API Ninjas (Datenbank)</option>
          </select>
        </label>

        <button
          type="submit"
          className="w-full rounded-xl bg-[var(--copper)] py-3 text-sm font-bold text-[#1A1209]"
        >
          Speichern
        </button>
      </form>

      <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
        <div className="mb-3 text-base font-bold">Daten-Export / Import</div>
        <button
          onClick={async () => {
            const json = await exportProfileJson();
            const blob = new Blob([json], { type: "application/json" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "fitai-profil.json";
            a.click();
            URL.revokeObjectURL(url);
          }}
          className="mb-2.5 w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)] py-3 text-sm font-semibold"
        >
          Profil + Plan exportieren (JSON)
        </button>
        <button
          onClick={() => importInputRef.current?.click()}
          className="w-full rounded-xl border border-[var(--hairline)] bg-[var(--surface-raised)] py-3 text-sm font-semibold"
        >
          Profil + Plan importieren (JSON)
        </button>
        <input
          ref={importInputRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            if (!file) return;
            const text = await file.text();
            await importProfileJson(text);
            e.target.value = "";
            showToast("Import abgeschlossen");
            router.refresh();
          }}
        />
      </div>

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full border border-[var(--hairline)] bg-[var(--surface-raised)] px-4 py-2.5 text-[12.5px]">
          {toast}
        </div>
      )}
    </div>
  );
}

function Field({
  label,
  unit,
  children,
}: {
  label: string;
  unit: string;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2.5">
      <div className="mb-1 font-mono text-[9.5px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
        {label}
      </div>
      {children}
      <span className="text-[11px] text-[var(--text-faint)]">{unit}</span>
    </div>
  );
}

function KeyField({
  label,
  name,
  defaultValue,
  placeholder,
}: {
  label: string;
  name: string;
  defaultValue?: string | null;
  placeholder: string;
}) {
  return (
    <label className="mb-3 block">
      <span className="mb-1 block font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
        {label}
      </span>
      <input
        type="password"
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface-raised)] p-2.5 font-mono text-[13px] outline-none focus:border-[var(--copper)]"
      />
    </label>
  );
}
