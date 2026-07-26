import { createClient } from "@/lib/supabase/server";
import SleepBoard from "./SleepBoard";
import type { SleepLogEntry } from "@/lib/types";

export default async function SleepPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: entries } = await supabase
    .from("sleep_log")
    .select("*")
    .eq("user_id", user!.id)
    .order("date", { ascending: false })
    .limit(30);

  return <SleepBoard initialEntries={(entries || []) as SleepLogEntry[]} />;
}
