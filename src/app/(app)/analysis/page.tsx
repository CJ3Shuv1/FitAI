import { createClient } from "@/lib/supabase/server";
import AnalysisBoard from "./AnalysisBoard";
import { ANALYSIS_MODULES } from "@/lib/analysisModules";

export default async function AnalysisPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ data: existing }, { data: settings }] = await Promise.all([
    supabase.from("overall_analysis").select("*").eq("user_id", user!.id).maybeSingle(),
    supabase.from("user_settings").select("*").eq("user_id", user!.id).maybeSingle(),
  ]);

  return (
    <AnalysisBoard
      initialContent={existing?.content ?? null}
      initialCreatedAt={existing?.created_at ?? null}
      hasAiKey={!!(settings && (settings.ai_provider === "gemini" ? settings.gemini_key : settings.groq_key))}
      moduleLabels={ANALYSIS_MODULES.map((m) => ({ key: m.key, label: m.label, emoji: m.emoji }))}
    />
  );
}
