import { createClient } from "@/lib/supabase/server";
import RecipeBoard from "./RecipeBoard";
import type { Food, Profile, Recipe, UserSettings } from "@/lib/types";

export default async function RecipesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: recipes }, { data: profile }, { data: settings }, { data: foods }] = await Promise.all([
    supabase.from("recipes").select("*").eq("user_id", user!.id).order("created_at", { ascending: false }),
    supabase.from("profiles").select("*").eq("user_id", user!.id).maybeSingle(),
    supabase.from("user_settings").select("*").eq("user_id", user!.id).maybeSingle(),
    supabase.from("foods").select("*").order("name", { ascending: true }),
  ]);

  return (
    <RecipeBoard
      recipes={(recipes || []) as Recipe[]}
      profile={profile as Profile | null}
      settings={settings as UserSettings | null}
      foods={(foods || []) as Food[]}
    />
  );
}
