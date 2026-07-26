import { createClient } from "@/lib/supabase/server";
import ReadingBoard from "./ReadingBoard";
import type { Book } from "@/lib/types";

export default async function ReadingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: books } = await supabase
    .from("books")
    .select("*")
    .eq("user_id", user!.id)
    .order("position", { ascending: true });

  return <ReadingBoard initialBooks={(books || []) as Book[]} />;
}
