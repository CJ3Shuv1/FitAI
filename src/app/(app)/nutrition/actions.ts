"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Macros } from "@/lib/ai";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, user };
}

// One row per calendar date — every one of the 7 weekdays is a valid date,
// nothing here restricts writes to Mon–Fri (that was the reported bug).
export async function saveNutritionText(date: string, text: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("nutrition_entries")
    .upsert(
      { user_id: user.id, date, text, updated_at: new Date().toISOString() },
      { onConflict: "user_id,date" }
    );
  revalidatePath("/nutrition");
}

export async function saveNutritionResult(date: string, result: Macros) {
  const { supabase, user } = await requireUser();
  await supabase.from("nutrition_entries").upsert(
    {
      user_id: user.id,
      date,
      kcal: result.kcal,
      protein: result.protein,
      carbs: result.carbs,
      fett: result.fett,
      zucker: result.zucker,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,date" }
  );
  revalidatePath("/nutrition");
}

export async function addRecipeToDay(
  date: string,
  recipeId: string,
  qty: number,
  macros: Macros
) {
  const { supabase, user } = await requireUser();
  await supabase.from("nutrition_recipe_entries").insert({
    user_id: user.id,
    date,
    recipe_id: recipeId,
    qty,
    kcal: macros.kcal,
    protein: macros.protein,
    carbs: macros.carbs,
    fett: macros.fett,
    zucker: macros.zucker,
  });
  revalidatePath("/nutrition");
}

export async function removeRecipeFromDay(entryId: string) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("nutrition_recipe_entries")
    .delete()
    .eq("id", entryId)
    .eq("user_id", user.id);
  revalidatePath("/nutrition");
}
