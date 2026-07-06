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

export async function addShoppingItem(name: string, amount: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("shopping_list_items").insert({ user_id: user.id, name, amount: amount || null });
  revalidatePath("/shopping");
}

export async function toggleShoppingItem(id: string, checked: boolean) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("shopping_list_items")
    .update({ checked })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/shopping");
}

export async function deleteShoppingItem(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("shopping_list_items").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/shopping");
}

export async function clearCheckedItems() {
  const { supabase, user } = await requireUser();
  await supabase.from("shopping_list_items").delete().eq("user_id", user.id).eq("checked", true);
  revalidatePath("/shopping");
}
