import { createClient } from "@/lib/supabase/server";
import SettingsForm from "./SettingsForm";
import { isProfileComplete } from "@/lib/types";
import type { Profile, UserSettings } from "@/lib/types";

export default async function SettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ onboarding?: string }>;
}) {
  const { onboarding } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: profile } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  const { data: settings } = await supabase
    .from("user_settings")
    .select("*")
    .eq("user_id", user!.id)
    .maybeSingle();

  return (
    <SettingsForm
      profile={profile as Profile | null}
      settings={settings as UserSettings | null}
      showOnboarding={onboarding === "1" && !isProfileComplete(profile as Profile | null)}
    />
  );
}
