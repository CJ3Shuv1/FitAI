import { createClient } from "@/lib/supabase/server";
import NutritionBoard from "./NutritionBoard";
import type { NutritionEntry, NutritionRecipeEntry, Profile, Recipe, UserSettings } from "@/lib/types";

export default async function NutritionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: entries }, { data: recipeEntries }, { data: recipes }, { data: profile }, { data: settings }] =
    await Promise.all([
      supabase.from("nutrition_entries").select("*").eq("user_id", user!.id),
      supabase.from("nutrition_recipe_entries").select("*").eq("user_id", user!.id),
      supabase.from("recipes").select("*").eq("user_id", user!.id),
      supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle(),
      supabase.from("user_settings").select("*").eq("user_id", user!.id).maybeSingle(),
    ]);

  return (
    <NutritionBoard
      initialEntries={(entries || []) as NutritionEntry[]}
      initialRecipeEntries={(recipeEntries || []) as NutritionRecipeEntry[]}
      recipes={(recipes || []) as Recipe[]}
      profile={profile as Profile | null}
      settings={settings as UserSettings | null}
    />
  );
}
