"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { normalizeName } from "@/lib/exerciseSync";
import type { Exercise } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, user };
}

export async function addDay(label: string, sub: string) {
  const { supabase, user } = await requireUser();
  const { count } = await supabase
    .from("training_days")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);
  const key = "day_" + Date.now();
  await supabase.from("training_days").insert({
    user_id: user.id,
    key,
    label: label || "Neuer Tag",
    sub: sub || null,
    position: count ?? 0,
  });
  revalidatePath("/training");
}

export async function deleteDay(dayId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("training_days").delete().eq("id", dayId).eq("user_id", user.id);
  revalidatePath("/training");
}

export async function addExercise(dayId: string, name: string) {
  const { supabase, user } = await requireUser();
  const { count } = await supabase
    .from("exercises")
    .select("id", { count: "exact", head: true })
    .eq("day_id", dayId);
  await supabase.from("exercises").insert({
    user_id: user.id,
    day_id: dayId,
    name: name || "Neue Übung",
    sets: 3,
    reps: 10,
    weight: null,
    notes: "",
    position: count ?? 0,
  });
  revalidatePath("/training");
}

export async function deleteExercise(exerciseId: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("exercises").delete().eq("id", exerciseId).eq("user_id", user.id);
  revalidatePath("/training");
}

type ExercisePatch = Partial<Pick<Exercise, "name" | "sets" | "reps" | "weight" | "notes">>;

export type LinkPrompt = {
  needsLinkDecision: true;
  normName: string;
  exerciseName: string;
  otherDayLabels: string[];
};

// Updates one exercise, then:
// - syncs it with any exercise in the same manual_group (sets & weight only)
// - if its (normalized) name matches other exercises and the user already
//   decided to keep this group linked, syncs name/sets/weight silently
// - if dismissed previously, leaves others untouched
// - otherwise, returns a decision prompt for the client to show a modal for
export async function updateExercise(
  exerciseId: string,
  patch: ExercisePatch
): Promise<LinkPrompt | { needsLinkDecision: false }> {
  const { supabase, user } = await requireUser();

  await supabase
    .from("exercises")
    .update(patch)
    .eq("id", exerciseId)
    .eq("user_id", user.id);

  const { data: ex } = await supabase
    .from("exercises")
    .select("*, training_days!inner(label)")
    .eq("id", exerciseId)
    .single();

  if (!ex) {
    revalidatePath("/training");
    return { needsLinkDecision: false };
  }

  // manual group sync (sets & weight only)
  if (ex.manual_group) {
    await supabase
      .from("exercises")
      .update({ sets: ex.sets, reps: ex.reps, weight: ex.weight })
      .eq("user_id", user.id)
      .eq("manual_group", ex.manual_group)
      .neq("id", ex.id);
  }

  const normName = normalizeName(ex.name);
  if (!normName) {
    revalidatePath("/training");
    return { needsLinkDecision: false };
  }

  const { data: allExercises } = await supabase
    .from("exercises")
    .select("id, name, day_id, training_days!inner(label)")
    .eq("user_id", user.id);

  const others = (allExercises || []).filter(
    (e) => e.id !== ex.id && normalizeName(e.name) === normName
  );

  if (others.length === 0) {
    revalidatePath("/training");
    return { needsLinkDecision: false };
  }

  const { data: link } = await supabase
    .from("exercise_links")
    .select("status")
    .eq("user_id", user.id)
    .eq("norm_name", normName)
    .maybeSingle();

  if (link?.status === "linked") {
    await Promise.all(
      others.map((o) =>
        supabase
          .from("exercises")
          .update({ name: ex.name, sets: ex.sets, reps: ex.reps, weight: ex.weight })
          .eq("id", o.id)
      )
    );
    revalidatePath("/training");
    return { needsLinkDecision: false };
  }

  if (link?.status === "dismissed") {
    revalidatePath("/training");
    return { needsLinkDecision: false };
  }

  revalidatePath("/training");
  return {
    needsLinkDecision: true,
    normName,
    exerciseName: ex.name,
    otherDayLabels: others.map((o) => {
      const rel = o.training_days as unknown as { label: string } | { label: string }[];
      return Array.isArray(rel) ? rel[0]?.label : rel.label;
    }),
  };
}

export async function resolveLinkDecision(
  exerciseId: string,
  normName: string,
  decision: "linked" | "dismissed"
) {
  const { supabase, user } = await requireUser();

  await supabase
    .from("exercise_links")
    .upsert(
      { user_id: user.id, norm_name: normName, status: decision },
      { onConflict: "user_id,norm_name" }
    );

  if (decision === "linked") {
    const { data: ex } = await supabase
      .from("exercises")
      .select("*")
      .eq("id", exerciseId)
      .single();
    if (ex) {
      const { data: allExercises } = await supabase
        .from("exercises")
        .select("id, name")
        .eq("user_id", user.id);
      const others = (allExercises || []).filter(
        (e) => e.id !== ex.id && normalizeName(e.name) === normName
      );
      await Promise.all(
        others.map((o) =>
          supabase
            .from("exercises")
            .update({ name: ex.name, sets: ex.sets, reps: ex.reps, weight: ex.weight })
            .eq("id", o.id)
        )
      );
    }
  }

  revalidatePath("/training");
}

export async function manualLink(exerciseId1: string, exerciseId2: string) {
  const { supabase, user } = await requireUser();
  const { data: exercisesData } = await supabase
    .from("exercises")
    .select("*")
    .in("id", [exerciseId1, exerciseId2])
    .eq("user_id", user.id);

  const ex1 = exercisesData?.find((e) => e.id === exerciseId1);
  const ex2 = exercisesData?.find((e) => e.id === exerciseId2);
  if (!ex1 || !ex2) return;

  let groupId: string;
  if (ex1.manual_group && ex2.manual_group && ex1.manual_group !== ex2.manual_group) {
    const oldGroup = ex2.manual_group;
    groupId = ex1.manual_group;
    await supabase
      .from("exercises")
      .update({ manual_group: groupId })
      .eq("user_id", user.id)
      .eq("manual_group", oldGroup);
  } else {
    groupId = ex1.manual_group || ex2.manual_group || "m_" + crypto.randomUUID();
    await supabase
      .from("exercises")
      .update({ manual_group: groupId })
      .in("id", [exerciseId1, exerciseId2])
      .eq("user_id", user.id);
  }

  await supabase
    .from("exercises")
    .update({ sets: ex1.sets, reps: ex1.reps, weight: ex1.weight })
    .eq("id", exerciseId2)
    .eq("user_id", user.id);

  revalidatePath("/training");
}
