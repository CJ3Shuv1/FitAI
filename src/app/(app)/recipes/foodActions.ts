"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { Food } from "@/lib/types";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, user };
}

export async function createFood(food: Omit<Food, "id" | "user_id">): Promise<Food | null> {
  const { supabase, user } = await requireUser();
  const { data } = await supabase
    .from("foods")
    .insert({ ...food, user_id: user.id })
    .select()
    .single();
  revalidatePath("/recipes");
  return (data as Food) ?? null;
}
