import { createClient } from "@/lib/supabase/server";
import TrainingBoard from "./TrainingBoard";
import type { ExerciseLibraryItem } from "@/lib/types";

export default async function TrainingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: days }, { data: exercises }, { data: library }] = await Promise.all([
    supabase
      .from("training_days")
      .select("*")
      .eq("user_id", user!.id)
      .order("position", { ascending: true }),
    supabase
      .from("exercises")
      .select("*")
      .eq("user_id", user!.id)
      .order("position", { ascending: true }),
    supabase.from("exercise_library").select("*").order("name", { ascending: true }),
  ]);

  return (
    <TrainingBoard
      initialDays={days || []}
      initialExercises={exercises || []}
      library={(library || []) as ExerciseLibraryItem[]}
    />
  );
}
