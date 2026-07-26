"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { BookStatus } from "@/lib/bookColors";

async function requireUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Nicht angemeldet");
  return { supabase, user };
}

export type BookInput = {
  status: BookStatus;
  title: string;
  author: string;
  year: number | null;
  genres: string[];
  notes: string[];
};

export async function createBook(input: BookInput) {
  const { supabase, user } = await requireUser();
  const { count } = await supabase
    .from("books")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id);

  await supabase.from("books").insert({
    user_id: user.id,
    status: input.status,
    title: input.title,
    author: input.author || "Unbekannt",
    year: input.year,
    genres: input.genres.length ? input.genres : ["Sachbuch"],
    notes: input.notes,
    position: count ?? 0,
  });

  revalidatePath("/reading");
  revalidatePath("/hub");
}

export async function updateBookStatus(id: string, status: BookStatus) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("books")
    .update({ status })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/reading");
}

export async function updateBookNotes(id: string, notes: string[]) {
  const { supabase, user } = await requireUser();
  await supabase
    .from("books")
    .update({ notes })
    .eq("id", id)
    .eq("user_id", user.id);
  revalidatePath("/reading");
}

export async function deleteBook(id: string) {
  const { supabase, user } = await requireUser();
  await supabase.from("books").delete().eq("id", id).eq("user_id", user.id);
  revalidatePath("/reading");
  revalidatePath("/hub");
}
