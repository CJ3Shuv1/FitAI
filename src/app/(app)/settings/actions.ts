"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Goal } from "@/lib/types";
import type { ThemeName } from "@/lib/themes";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, user };
}

export async function saveProfile(formData: FormData) {
  const { supabase, user } = await requireUser();

  const num = (key: string) => {
    const v = formData.get(key);
    if (v === null || v === "") return null;
    const n = parseFloat(String(v));
    return Number.isNaN(n) ? null : n;
  };

  await supabase.from("profiles").upsert({
    user_id: user.id,
    weight: num("weight"),
    height: num("height"),
    age: num("age"),
    goal: (formData.get("goal") as Goal) || null,
    activity_factor: num("activity_factor"),
    protein_per_kg: num("protein_per_kg"),
    fat_percent: num("fat_percent"),
    kcal_adjust: num("kcal_adjust"),
    sugar_percent: num("sugar_percent"),
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/settings");
  revalidatePath("/nutrition");
}

export async function saveAISettings(formData: FormData) {
  const { supabase, user } = await requireUser();

  await supabase.from("user_settings").upsert({
    user_id: user.id,
    ai_provider: (formData.get("ai_provider") as string) || "gemini",
    groq_key: (formData.get("groq_key") as string) || null,
    gemini_key: (formData.get("gemini_key") as string) || null,
    pexels_key: (formData.get("pexels_key") as string) || null,
    api_ninjas_key: (formData.get("api_ninjas_key") as string) || null,
    nutrition_method: (formData.get("nutrition_method") as string) || "ai",
    updated_at: new Date().toISOString(),
  });

  revalidatePath("/settings");
}

export async function saveTheme(theme: ThemeName) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("user_settings")
    .upsert({ user_id: user.id, theme, updated_at: new Date().toISOString() });
  revalidatePath("/", "layout");
}

type ImportPayload = {
  profile?: Record<string, unknown>;
  trainingPlan?: Record<
    string,
    { name: string; sets: number; weight: number | null; notes: string; isPR?: boolean }[]
  >;
};

// Imports a profile+plan JSON in the shape exported by "Profil exportieren"
// (also matches the shape of the one-off cedric_original_profile.json seed).
export async function importProfileJson(json: string) {
  const { supabase, user } = await requireUser();
  const payload = JSON.parse(json) as ImportPayload;

  if (payload.profile) {
    const p = payload.profile as Record<string, number | string | undefined>;
    await supabase.from("profiles").upsert({
      user_id: user.id,
      weight: p.weight ?? null,
      height: p.height ?? null,
      age: p.age ?? null,
      goal: p.goal ?? null,
      activity_factor: p.activityFactor ?? null,
      protein_per_kg: p.proteinPerKg ?? null,
      fat_percent: p.fatPercent ?? null,
      kcal_adjust: p.kcalAdjust ?? null,
      sugar_percent: p.sugarPercent ?? null,
      updated_at: new Date().toISOString(),
    });
  }

  if (payload.trainingPlan) {
    let position = 0;
    for (const [dayKey, exercises] of Object.entries(payload.trainingPlan)) {
      const { data: day } = await supabase
        .from("training_days")
        .insert({
          user_id: user.id,
          key: dayKey,
          label: dayKey,
          position: position++,
        })
        .select()
        .single();
      if (!day) continue;

      await supabase.from("exercises").insert(
        exercises.map((ex, i) => ({
          user_id: user.id,
          day_id: day.id,
          name: ex.name,
          sets: ex.sets,
          weight: ex.weight,
          notes: ex.notes,
          is_pr: !!ex.isPR,
          position: i,
        }))
      );
    }
  }

  revalidatePath("/training");
  revalidatePath("/settings");
}

export async function exportProfileJson() {
  const { supabase, user } = await requireUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: days } = await supabase
    .from("training_days")
    .select("*, exercises(*)")
    .eq("user_id", user.id)
    .order("position");

  const trainingPlan: Record<
    string,
    { name: string; sets: number | null; weight: number | null; notes: string | null; isPR: boolean }[]
  > = {};
  for (const day of days || []) {
    const exs = (day.exercises as { name: string; sets: number | null; weight: number | null; notes: string | null; is_pr: boolean; position: number }[])
      .sort((a, b) => a.position - b.position)
      .map((e) => ({
        name: e.name,
        sets: e.sets,
        weight: e.weight,
        notes: e.notes,
        isPR: e.is_pr,
      }));
    trainingPlan[day.label] = exs;
  }

  return JSON.stringify(
    {
      profile: profile
        ? {
            weight: profile.weight,
            height: profile.height,
            age: profile.age,
            goal: profile.goal,
            activityFactor: profile.activity_factor,
            proteinPerKg: profile.protein_per_kg,
            fatPercent: profile.fat_percent,
            kcalAdjust: profile.kcal_adjust,
            sugarPercent: profile.sugar_percent,
          }
        : null,
      trainingPlan,
    },
    null,
    2
  );
}
