"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Goal, Profile, Recipe, UserSettings } from "@/lib/types";
import { callAI } from "@/lib/ai";
import { createRecipe, deleteRecipe } from "./actions";

const DIFF_LABEL: Record<string, string> = {
  einfach: "Einfach (wenig Schritte, keine besonderen Techniken)",
  mittel: "Mittel (etwas Übung nötig)",
  anspruchsvoll: "Anspruchsvoll (mehr Schritte/Technik erlaubt)",
};

async function fetchPexelsImage(key: string, query: string): Promise<string | null> {
  if (!key) return null;
  try {
    const res = await fetch(
      "https://api.pexels.com/v1/search?query=" + encodeURIComponent(query) + "&per_page=1&orientation=landscape",
      { headers: { Authorization: key } }
    );
    if (!res.ok) return null;
    const data = await res.json();
    return data.photos?.[0]?.src?.large ?? null;
  } catch {
    return null;
  }
}

export default function RecipeBoard({
  recipes,
  profile,
  settings,
}: {
  recipes: Recipe[];
  profile: Profile | null;
  settings: UserSettings | null;
}) {
  const router = useRouter();
  const [tab, setTab] = useState<"generate" | "saved">("generate");
  const [wish, setWish] = useState("");
  const [goal, setGoal] = useState<Goal>(profile?.goal ?? "bulk");
  const [difficulty, setDifficulty] = useState<"einfach" | "mittel" | "anspruchsvoll">("einfach");
  const [cookTime, setCookTime] = useState(30);
  const [loading, setLoading] = useState(false);
  const [preview, setPreview] = useState<Omit<Recipe, "id" | "user_id"> | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  async function generate() {
    if (!settings) {
      showToast("Bitte zuerst in den Einstellungen einen API-Key hinterlegen");
      return;
    }
    const key = settings.ai_provider === "gemini" ? settings.gemini_key : settings.groq_key;
    if (!key) {
      showToast("Bitte zuerst API-Key in den Einstellungen eintragen");
      return;
    }

    setLoading(true);
    try {
      const goalLabel = { bulk: "Kalorienüberschuss (Bulk)", cut: "Kaloriendefizit (Cut)", maintenance: "Erhaltung (Maintenance)" }[goal];
      const systemPrompt =
        `Du bist ein kreativer Koch und Ernährungsberater. Erstelle ein Rezept (1 Portion) passend zur Phase ${goalLabel}. ` +
        `Schwierigkeitsgrad: ${DIFF_LABEL[difficulty]}. Gewünschte Gesamt-Zubereitungszeit ca. ${cookTime} Minuten (±10 Min). ` +
        `${wish.trim() ? "Wunsch des Nutzers: " + wish.trim() + ". " : ""}` +
        `Antworte AUSSCHLIESSLICH mit einem JSON-Objekt: {"title": string, "kcal_per_serving": number, "protein_per_serving": number, "carbs_per_serving": number, "fett_per_serving": number, "zucker_per_serving": number, "cook_time_minutes": number, "difficulty": "einfach"|"mittel"|"anspruchsvoll", "ingredients": [{"name": string, "amount": string, "unit": string}], "steps": [string]}.`;

      const content = await callAI(settings.ai_provider, key, systemPrompt, wish || "Überrasch mich", { json: true });
      const parsed = JSON.parse(content);
      const num = (v: unknown, fallback = 0) => {
        const n = parseFloat(String(v));
        return Number.isNaN(n) ? fallback : Math.round(n);
      };
      const validDiff = ["einfach", "mittel", "anspruchsvoll"];

      let imageUrl: string | null = null;
      if (settings.pexels_key) {
        imageUrl = await fetchPexelsImage(settings.pexels_key, parsed.title || wish);
      }

      setPreview({
        title: parsed.title || "Unbenanntes Rezept",
        kcal_per_serving: num(parsed.kcal_per_serving),
        protein_per_serving: num(parsed.protein_per_serving),
        carbs_per_serving: num(parsed.carbs_per_serving),
        fett_per_serving: num(parsed.fett_per_serving),
        zucker_per_serving: num(parsed.zucker_per_serving),
        image_url: imageUrl,
        cook_time_minutes: num(parsed.cook_time_minutes, cookTime),
        difficulty: validDiff.includes(parsed.difficulty) ? parsed.difficulty : difficulty,
        ingredients: Array.isArray(parsed.ingredients) ? parsed.ingredients : [],
        steps: Array.isArray(parsed.steps) ? parsed.steps : [],
      });
    } catch (err) {
      showToast("Generierung fehlgeschlagen: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-3xl font-extrabold uppercase tracking-tight">Rezepte</h1>

      <div className="mb-4 flex gap-2">
        <button
          onClick={() => setTab("generate")}
          className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold ${tab === "generate" ? "border-[var(--copper-dim)] bg-[var(--surface-raised)]" : "border-[var(--hairline)] text-[var(--text-faint)]"}`}
        >
          Generieren
        </button>
        <button
          onClick={() => setTab("saved")}
          className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold ${tab === "saved" ? "border-[var(--copper-dim)] bg-[var(--surface-raised)]" : "border-[var(--hairline)] text-[var(--text-faint)]"}`}
        >
          Gespeichert ({recipes.length})
        </button>
      </div>

      {tab === "generate" ? (
        <div>
          <div className="mb-3 flex gap-2">
            {(["bulk", "cut", "maintenance"] as const).map((g) => (
              <button
                key={g}
                onClick={() => setGoal(g)}
                className={`flex-1 rounded-xl border py-2.5 text-xs font-semibold ${goal === g ? "border-[var(--copper)] bg-[var(--copper)] text-[#1A1209]" : "border-[var(--hairline)] text-[var(--text-faint)]"}`}
              >
                {{ bulk: "Bulk", cut: "Cut", maintenance: "Maintenance" }[g]}
              </button>
            ))}
          </div>

          <select
            value={difficulty}
            onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
            className="mb-3 w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-2.5 text-sm"
          >
            <option value="einfach">Einfach</option>
            <option value="mittel">Mittel</option>
            <option value="anspruchsvoll">Anspruchsvoll</option>
          </select>

          <label className="mb-3 block">
            <span className="mb-1 flex justify-between font-mono text-[11px] text-[var(--text-dim)]">
              <span>Gewünschte Kochzeit</span>
              <span className="text-[var(--copper)]">⏱ ~{cookTime} Min</span>
            </span>
            <input
              type="range"
              min={5}
              max={90}
              step={5}
              value={cookTime}
              onChange={(e) => setCookTime(parseInt(e.target.value, 10))}
              className="w-full"
            />
          </label>

          <input
            value={wish}
            onChange={(e) => setWish(e.target.value)}
            placeholder="Wunsch? z.B. 'etwas mit Hähnchen und Reis'"
            className="mb-3 w-full rounded-lg border border-[var(--hairline)] bg-[var(--surface)] p-3 text-sm outline-none focus:border-[var(--copper)]"
          />

          <button
            onClick={generate}
            disabled={loading}
            className="mb-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--copper)] p-3.5 text-sm font-bold text-[#1A1209] disabled:opacity-60"
          >
            {loading ? "Generiere…" : "✨ Rezept generieren"}
          </button>

          {preview && (
            <div className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
              {preview.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={preview.image_url}
                  alt={preview.title}
                  className="mb-3 h-[160px] w-full rounded-xl object-cover"
                />
              )}
              <div className="mb-2 text-lg font-bold">{preview.title}</div>
              <div className="mb-3 flex flex-wrap gap-2">
                <Chip>{preview.kcal_per_serving} kcal</Chip>
                <Chip>{preview.protein_per_serving}g P</Chip>
                <Chip>⏱ {preview.cook_time_minutes} Min</Chip>
                <Chip>{preview.difficulty}</Chip>
              </div>
              <div className="mb-2 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                Zutaten
              </div>
              {preview.ingredients.map((i, idx) => (
                <div key={idx} className="flex justify-between border-b border-[var(--hairline)] py-2 text-[13.5px] last:border-none">
                  <span>{i.name}</span>
                  <span className="font-mono text-[var(--steel)]">{i.amount}{i.unit}</span>
                </div>
              ))}
              <div className="mb-2 mt-3 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--text-faint)]">
                Zubereitung
              </div>
              {preview.steps.map((s, idx) => (
                <div key={idx} className="mb-2 flex gap-2.5 text-[13.5px] text-[var(--text-dim)]">
                  <span className="flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border border-[var(--hairline)] font-mono text-[11px] font-bold text-[var(--copper)]">
                    {idx + 1}
                  </span>
                  <span>{s}</span>
                </div>
              ))}

              <button
                onClick={async () => {
                  await createRecipe(preview);
                  setPreview(null);
                  setTab("saved");
                  router.refresh();
                  showToast("Rezept gespeichert");
                }}
                className="mt-3 w-full rounded-xl bg-[var(--copper)] py-3 text-sm font-bold text-[#1A1209]"
              >
                Speichern
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {recipes.length === 0 && (
            <p className="text-sm text-[var(--text-faint)]">
              Noch keine gespeicherten Rezepte.
            </p>
          )}
          {recipes.map((r) => (
            <div key={r.id} className="rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
              {r.image_url && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={r.image_url} alt={r.title} className="mb-3 h-[140px] w-full rounded-xl object-cover" />
              )}
              <div className="mb-2 flex items-start justify-between gap-2">
                <div className="text-base font-bold">{r.title}</div>
                <button
                  onClick={async () => {
                    if (confirm(`"${r.title}" löschen?`)) {
                      await deleteRecipe(r.id);
                      router.refresh();
                    }
                  }}
                  className="text-[var(--text-faint)]"
                >
                  ✕
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Chip>{r.kcal_per_serving} kcal</Chip>
                <Chip>{r.protein_per_serving}g P</Chip>
                {r.cook_time_minutes && <Chip>⏱ {r.cook_time_minutes} Min</Chip>}
                {r.difficulty && <Chip>{r.difficulty}</Chip>}
              </div>
            </div>
          ))}
        </div>
      )}

      {toast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 rounded-full border border-[var(--hairline)] bg-[var(--surface-raised)] px-4 py-2.5 text-[12.5px]">
          {toast}
        </div>
      )}
    </div>
  );
}

function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full border border-[var(--hairline)] bg-[var(--surface-raised)] px-2.5 py-1 font-mono text-[10.5px] text-[var(--text-dim)]">
      {children}
    </span>
  );
}
