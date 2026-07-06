"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Recipe } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, user };
}

export async function createRecipe(recipe: Omit<Recipe, "id" | "user_id">) {
  const { supabase, user } = await requireUser();
  await supabase.from("recipes").insert({ ...recipe, user_id: user.id });
  revalidatePath("/recipes");
  revalidatePath("/nutrition");
}

export async function deleteRecipe(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("recipes").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/recipes");
  revalidatePath("/nutrition");
}
