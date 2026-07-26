import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTargets, isProfileComplete, type Profile } from "./types";

export type ModuleSummary = {
  key: string;
  label: string;
  emoji: string;
  /** Plain-text block fed into the AI prompt. */
  text: string;
  /** Small facts snapshot stored for next-time delta comparisons. */
  snapshot: Record<string, unknown>;
};

export type AnalysisModule = {
  key: string;
  label: string;
  emoji: string;
  summarize: (supabase: SupabaseClient, userId: string) => Promise<ModuleSummary | null>;
};

async function summarizeTraining(
  supabase: SupabaseClient,
  userId: string
): Promise<ModuleSummary | null> {
  const { data: days } = await supabase
    .from("training_days")
    .select("label, exercises(name, sets, reps, weight, created_at)")
    .eq("user_id", userId);

  if (!days || days.length === 0) return null;

  type Ex = { name: string; sets: number | null; reps: number | null; weight: number | null; created_at: string };
  const allExercises = days.flatMap((d) => (d.exercises as Ex[]) || []);
  const fourteenDaysAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
  const recentlyAdded = allExercises.filter(
    (e) => new Date(e.created_at).getTime() > fourteenDaysAgo
  );

  const lines = days.map((d) => {
    const exs = (d.exercises as Ex[]) || [];
    const list = exs
      .map((e) => `${e.name} (${e.sets ?? "?"}×${e.reps ?? "?"}${e.weight ? ", " + e.weight + "kg" : ""})`)
      .join(", ");
    return `${d.label}: ${list || "keine Übungen"}`;
  });

  const text = [
    `Trainingsplan mit ${days.length} Tagen, ${allExercises.length} Übungen insgesamt.`,
    ...lines,
    recentlyAdded.length > 0
      ? `In den letzten 14 Tagen neu hinzugefügt: ${recentlyAdded.map((e) => e.name).join(", ")}.`
      : "Keine neuen Übungen in den letzten 14 Tagen.",
  ].join("\n");

  return {
    key: "training",
    label: "Training",
    emoji: "🏋️",
    text,
    snapshot: { dayCount: days.length, exerciseCount: allExercises.length },
  };
}

async function summarizeNutrition(
  supabase: SupabaseClient,
  userId: string
): Promise<ModuleSummary | null> {
  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const fourteenDaysAgoStr = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data: entries } = await supabase
    .from("nutrition_entries")
    .select("date, kcal, protein, carbs, fett, zucker")
    .eq("user_id", userId)
    .gte("date", fourteenDaysAgoStr)
    .order("date", { ascending: false });

  if (!entries || entries.length === 0) {
    if (!profile) return null;
    return {
      key: "nutrition",
      label: "Ernährung",
      emoji: "🍽",
      text: "Profil vorhanden, aber noch keine Ernährungs-Einträge in den letzten 14 Tagen.",
      snapshot: { loggedDays: 0 },
    };
  }

  const withData = entries.filter((e) => e.kcal != null);
  const avg = (key: "kcal" | "protein" | "carbs" | "fett" | "zucker") =>
    withData.length ? Math.round(withData.reduce((s, e) => s + (e[key] ?? 0), 0) / withData.length) : 0;

  let targetLine = "";
  if (isProfileComplete(profile as Profile | null)) {
    const t = computeTargets(profile as unknown as Parameters<typeof computeTargets>[0]);
    targetLine = ` Ziel: ${t.kcal} kcal / ${t.protein}g Protein. Ø tatsächlich: ${avg("kcal")} kcal / ${avg("protein")}g Protein.`;
  }

  const text =
    `${withData.length} von ${entries.length} Tagen (letzte 14 Tage) mit Ernährungsdaten erfasst.` +
    targetLine;

  return {
    key: "nutrition",
    label: "Ernährung",
    emoji: "🍽",
    text,
    snapshot: { loggedDays: withData.length, avgKcal: avg("kcal"), avgProtein: avg("protein") },
  };
}

async function summarizeBooks(
  supabase: SupabaseClient,
  userId: string
): Promise<ModuleSummary | null> {
  const { data: books } = await supabase
    .from("books")
    .select("status, title, notes, created_at")
    .eq("user_id", userId);

  if (!books || books.length === 0) return null;

  const done = books.filter((b) => b.status === "done");
  const open = books.filter((b) => b.status === "open");
  const plan = books.filter((b) => b.status === "plan");

  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recentlyFinished = done.filter((b) => new Date(b.created_at).getTime() > thirtyDaysAgo);

  const text = [
    `${done.length} durchgelesen, ${open.length} angefangen, ${plan.length} geplant.`,
    open.length > 0 ? `Gerade dabei: ${open.map((b) => b.title).join(", ")}.` : "",
    recentlyFinished.length > 0
      ? `Kürzlich durchgelesen: ${recentlyFinished.map((b) => b.title).join(", ")}.`
      : "",
  ]
    .filter(Boolean)
    .join(" ");

  return {
    key: "books",
    label: "Bücher",
    emoji: "📚",
    text,
    snapshot: { done: done.length, open: open.length, plan: plan.length },
  };
}

// ---------------------------------------------------------------------
// The registry. To wire up a future tab into the Gesamtanalyse, add one
// more module here — /analysis itself never needs to change, it just
// iterates whatever is registered.
// ---------------------------------------------------------------------
export const ANALYSIS_MODULES: AnalysisModule[] = [
  { key: "training", label: "Training", emoji: "🏋️", summarize: summarizeTraining },
  { key: "nutrition", label: "Ernährung", emoji: "🍽", summarize: summarizeNutrition },
  { key: "books", label: "Bücher", emoji: "📚", summarize: summarizeBooks },
];
