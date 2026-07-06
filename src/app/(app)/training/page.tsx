import { createClient } from "@/lib/supabase/server";
import TrainingBoard from "./TrainingBoard";

export default async function TrainingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: days } = await supabase
    .from("training_days")
    .select("*")
    .eq("user_id", user!.id)
    .order("position", { ascending: true });

  const { data: exercises } = await supabase
    .from("exercises")
    .select("*")
    .eq("user_id", user!.id)
    .order("position", { ascending: true });

  return (
    <TrainingBoard
      initialDays={days || []}
      initialExercises={exercises || []}
    />
  );
}
