"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, user };
}

export type ExtractedDay = {
  label: string;
  sub?: string;
  exercises: { name: string; sets: number | null; reps: number | null; weight: number | null; notes?: string }[];
};

// Persists the (user-reviewed, possibly edited) extraction result as new
// training days + exercises, appended after any existing days.
export async function commitExtractedPlan(days: ExtractedDay[]) {
  const { supabase, user } = await requireUser();

  const { count } = await supabase
    .from("training_days")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  let position = count ?? 0;

  for (const day of days) {
    const { data: inserted } = await supabase
      .from("training_days")
      .insert({
        user_id: user.id,
        key: "day_" + Date.now() + "_" + position,
        label: day.label,
        sub: day.sub || null,
        position: position++,
      })
      .select()
      .single();
    if (!inserted) continue;

    if (day.exercises.length > 0) {
      await supabase.from("exercises").insert(
        day.exercises.map((ex, i) => ({
          user_id: user.id,
          day_id: inserted.id,
          name: ex.name,
          sets: ex.sets,
          reps: ex.reps,
          weight: ex.weight,
          notes: ex.notes || "",
          position: i,
        }))
      );
    }
  }

  revalidatePath("/training");
}
