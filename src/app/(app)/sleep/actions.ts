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

export async function saveSleep(date: string, hours: number) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("sleep_log")
    .upsert({ user_id: user.id, date, hours }, { onConflict: "user_id,date" });
  revalidatePath("/sleep");
  revalidatePath("/hub");
}

export async function deleteSleep(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("sleep_log").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/sleep");
}
