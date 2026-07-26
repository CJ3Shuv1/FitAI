"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { ANALYSIS_MODULES } from "@/lib/analysisModules";
import { callAI } from "@/lib/ai";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, user };
}

export async function runAnalysis(): Promise<
  { error: string } | { content: string; modulesUsed: string[] }
> {
  const { supabase, user } = await requireUser();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const key = settings?.ai_provider === "gemini" ? settings?.gemini_key : settings?.groq_key;
  if (!settings || !key) {
    return { error: "Bitte zuerst einen API-Key in den Einstellungen hinterlegen." };
  }

  // Fetch the previous run first so every module can diff against its own
  // slice of the last snapshot and report explicit deltas (not just current
  // state) — this is what lets the analysis actually say "+5kg on X" instead
  // of just restating today's numbers.
  const { data: previous } = await supabase
    .from("overall_analysis")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  const previousSnapshot = (previous?.snapshot ?? {}) as Record<string, Record<string, unknown>>;

  // Every registered module contributes its own text block — this loop is
  // the only place that needs to know the modules exist, so a future tab
  // just registers itself in lib/analysisModules.ts and shows up here too.
  const summaries = await Promise.all(
    ANALYSIS_MODULES.map((m) => m.summarize(supabase, user.id, previousSnapshot[m.key] ?? null))
  );
  const present = summaries.filter((s): s is NonNullable<typeof s> => s !== null);

  if (present.length === 0) {
    return {
      error:
        "Noch nicht genug Daten für eine Gesamtanalyse — leg erst etwas in Training, Ernährung oder Büchern an.",
    };
  }

  const snapshot = Object.fromEntries(present.map((s) => [s.key, s.snapshot]));
  const contextText = present.map((s) => `## ${s.label}\n${s.text}`).join("\n\n");

  const systemPrompt =
    "Du bist ein ganzheitlicher, warmherziger aber ehrlicher Lebens-Coach. Der Nutzer hat eine App mit mehreren Bereichen (Training, Ernährung, Schlaf, Lesen, ggf. weitere). " +
    "Du bekommst pro Bereich eine Faktenzusammenfassung — falls vorhanden bereits inklusive konkreter Änderungen seit der letzten Analyse (z.B. Gewichtssteigerungen bei Übungen, veränderte Kalorienzufuhr). " +
    "Schreibe eine kurze, zusammenhängende Gesamtanalyse auf Deutsch (max. 200 Wörter): Hebe zuerst die konkreten Änderungen hervor, dann was gut läuft, was an Konsistenz fehlt, und wo es Zusammenhänge zwischen den Bereichen gibt (z.B. Trainingsintensität und Ernährung, oder Schlaf und Trainingsleistung). " +
    "Sei konkret und nutze die Zahlen, aber vermeide Floskeln. Kein Fazit-Absatz mit Wiederholung, direkt zur Sache.";

  try {
    const content = await callAI(
      settings.ai_provider,
      key,
      systemPrompt,
      contextText,
      { temperature: 0.4 }
    );

    await supabase.from("overall_analysis").upsert({
      user_id: user.id,
      content: content.trim(),
      snapshot,
      created_at: new Date().toISOString(),
    });

    revalidatePath("/analysis");
    return { content: content.trim(), modulesUsed: present.map((s) => s.key) };
  } catch (err) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
}
