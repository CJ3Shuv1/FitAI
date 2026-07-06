import { createClient } from "@/lib/supabase/server";
import UploadBoard from "./UploadBoard";
import type { UserSettings } from "@/lib/types";

export default async function UploadPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  return <UploadBoard settings={settings as UserSettings | null} />;
}
