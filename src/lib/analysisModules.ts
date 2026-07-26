import type { SupabaseClient } from "@supabase/supabase-js";
import { computeTargets, isProfileComplete, type Profile } from "./types";

export type ModuleSummary = {
  key: string;
  label: string;
  emoji: string;
  /** Plain-text block fed into the AI prompt — includes explicit deltas
   *  against the previous snapshot when one was passed in, so the model
   *  doesn't have to infer "what changed" from raw prose itself. */
  text: string;
  /** Small facts snapshot stored for next-time delta comparisons. */
  snapshot: Record<string, unknown>;
};

export type AnalysisModule = {
  key: string;
  label: string;
  emoji: string;
  summarize: (
    supabase: SupabaseClient,
    userId: string,
    previousSnapshot: Record<string, unknown> | null
  ) => Promise<ModuleSummary | null>;
};

function fmtDelta(n: number, unit = "") {
  if (n === 0) return null;
  return (n > 0 ? "+" : "") + n + unit;
}

// ---------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------
type ExerciseSnapshotEntry = { name: string; weight: number | null; sets: number | null; reps: number | null };
type TrainingSnapshot = { exercises: Record<string, ExerciseSnapshotEntry> };

async function summarizeTraining(
  supabase: SupabaseClient,
  userId: string,
  previousSnapshot: Record<string, unknown> | null
): Promise<ModuleSummary | null> {
  const { data: days } = await supabase
    .from("training_days")
    .select("label, exercises(id, name, sets, reps, weight, created_at)")
    .eq("user_id", userId);

  if (!days || days.length === 0) return null;

  type Ex = { id: string; name: string; sets: number | null; reps: number | null; weight: number | null; created_at: string };
  const allExercises = days.flatMap((d) => (d.exercises as Ex[]) || []);

  const snapshot: TrainingSnapshot = {
    exercises: Object.fromEntries(
      allExercises.map((e) => [e.id, { name: e.name, weight: e.weight, sets: e.sets, reps: e.reps }])
    ),
  };

  const prevTraining = previousSnapshot as TrainingSnapshot | null;
  const changeLines: string[] = [];

  if (prevTraining?.exercises) {
    for (const ex of allExercises) {
      const before = prevTraining.exercises[ex.id];
      if (!before) {
        changeLines.push(`Neu im Plan: "${ex.name}"`);
        continue;
      }
      if (before.weight != null && ex.weight != null && before.weight !== ex.weight) {
        const d = fmtDelta(Math.round((ex.weight - before.weight) * 10) / 10, "kg");
        changeLines.push(`"${ex.name}": ${before.weight}kg → ${ex.weight}kg (${d})`);
      }
      if (before.sets != null && ex.sets != null && before.sets !== ex.sets) {
        changeLines.push(`"${ex.name}": Sätze ${before.sets} → ${ex.sets}`);
      }
    }
    const currentIds = new Set(allExercises.map((e) => e.id));
    for (const [id, before] of Object.entries(prevTraining.exercises)) {
      if (!currentIds.has(id)) changeLines.push(`Entfernt: "${before.name}"`);
    }
  }

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
    changeLines.length > 0
      ? `Änderungen seit letzter Analyse:\n- ${changeLines.join("\n- ")}`
      : prevTraining
        ? "Keine Änderungen an Gewicht/Sätzen seit letzter Analyse."
        : "",
  ]
    .filter(Boolean)
    .join("\n");

  return { key: "training", label: "Training", emoji: "🏋️", text, snapshot };
}

// ---------------------------------------------------------------------
// Nutrition
// ---------------------------------------------------------------------
type NutritionSnapshot = { loggedDays: number; avgKcal: number; avgProtein: number };

async function summarizeNutrition(
  supabase: SupabaseClient,
  userId: string,
  previousSnapshot: Record<string, unknown> | null
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

  const prevNutrition = previousSnapshot as NutritionSnapshot | null;

  if (!entries || entries.length === 0) {
    if (!profile) return null;
    return {
      key: "nutrition",
      label: "Ernährung",
      emoji: "🍽",
      text: "Profil vorhanden, aber noch keine Ernährungs-Einträge in den letzten 14 Tagen.",
      snapshot: { loggedDays: 0, avgKcal: 0, avgProtein: 0 },
    };
  }

  const withData = entries.filter((e) => e.kcal != null);
  const avg = (key: "kcal" | "protein" | "carbs" | "fett" | "zucker") =>
    withData.length ? Math.round(withData.reduce((s, e) => s + (e[key] ?? 0), 0) / withData.length) : 0;
  const avgKcal = avg("kcal");
  const avgProtein = avg("protein");

  let targetLine = "";
  if (isProfileComplete(profile as Profile | null)) {
    const t = computeTargets(profile as unknown as Parameters<typeof computeTargets>[0]);
    targetLine = ` Ziel: ${t.kcal} kcal / ${t.protein}g Protein. Ø tatsächlich: ${avgKcal} kcal / ${avgProtein}g Protein.`;
  }

  const deltaLines: string[] = [];
  if (prevNutrition) {
    const kcalDelta = fmtDelta(avgKcal - prevNutrition.avgKcal, " kcal");
    const proteinDelta = fmtDelta(avgProtein - prevNutrition.avgProtein, "g");
    if (kcalDelta) deltaLines.push(`Ø Kalorien ${kcalDelta} seit letzter Analyse (davor Ø ${prevNutrition.avgKcal} kcal).`);
    if (proteinDelta) deltaLines.push(`Ø Protein ${proteinDelta} seit letzter Analyse (davor Ø ${prevNutrition.avgProtein}g).`);
  }

  const text = [
    `${withData.length} von ${entries.length} Tagen (letzte 14 Tage) mit Ernährungsdaten erfasst.${targetLine}`,
    ...deltaLines,
  ].join("\n");

  return {
    key: "nutrition",
    label: "Ernährung",
    emoji: "🍽",
    text,
    snapshot: { loggedDays: withData.length, avgKcal, avgProtein },
  };
}

// ---------------------------------------------------------------------
// Books
// ---------------------------------------------------------------------
type BooksSnapshot = { done: number; open: number; plan: number };

async function summarizeBooks(
  supabase: SupabaseClient,
  userId: string,
  previousSnapshot: Record<string, unknown> | null
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

  const prevBooks = previousSnapshot as BooksSnapshot | null;
  const deltaLines: string[] = [];
  if (prevBooks) {
    const doneDelta = fmtDelta(done.length - prevBooks.done);
    if (doneDelta) deltaLines.push(`${doneDelta} durchgelesen seit letzter Analyse.`);
  }

  const text = [
    `${done.length} durchgelesen, ${open.length} angefangen, ${plan.length} geplant.`,
    open.length > 0 ? `Gerade dabei: ${open.map((b) => b.title).join(", ")}.` : "",
    recentlyFinished.length > 0
      ? `Kürzlich durchgelesen: ${recentlyFinished.map((b) => b.title).join(", ")}.`
      : "",
    ...deltaLines,
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
// Sleep
// ---------------------------------------------------------------------
type SleepSnapshot = { avgHours: number; loggedNights: number };

async function summarizeSleep(
  supabase: SupabaseClient,
  userId: string,
  previousSnapshot: Record<string, unknown> | null
): Promise<ModuleSummary | null> {
  const fourteenDaysAgoStr = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const { data: entries } = await supabase
    .from("sleep_log")
    .select("date, hours")
    .eq("user_id", userId)
    .gte("date", fourteenDaysAgoStr);

  if (!entries || entries.length === 0) return null;

  const avgHours = Math.round((entries.reduce((s, e) => s + e.hours, 0) / entries.length) * 10) / 10;
  const prevSleep = previousSnapshot as SleepSnapshot | null;

  const deltaLines: string[] = [];
  if (prevSleep) {
    const delta = fmtDelta(Math.round((avgHours - prevSleep.avgHours) * 10) / 10, "h");
    if (delta) deltaLines.push(`Ø Schlaf ${delta} seit letzter Analyse (davor Ø ${prevSleep.avgHours}h).`);
  }

  const text = [
    `${entries.length} Nächte in den letzten 14 Tagen erfasst, Ø ${avgHours}h.`,
    ...deltaLines,
  ].join("\n");

  return {
    key: "sleep",
    label: "Schlaf",
    emoji: "🌙",
    text,
    snapshot: { avgHours, loggedNights: entries.length },
  };
}

// ---------------------------------------------------------------------
// The registry. To wire up a future tab into the Gesamtanalyse, add one
// more module here — /analysis itself never needs to change, it just
// iterates whatever is registered and hands each one the previous run's
// snapshot for that module so it can report explicit deltas.
// ---------------------------------------------------------------------
export const ANALYSIS_MODULES: AnalysisModule[] = [
  { key: "training", label: "Training", emoji: "🏋️", summarize: summarizeTraining },
  { key: "nutrition", label: "Ernährung", emoji: "🍽", summarize: summarizeNutrition },
  { key: "sleep", label: "Schlaf", emoji: "🌙", summarize: summarizeSleep },
  { key: "books", label: "Bücher", emoji: "📚", summarize: summarizeBooks },
];
