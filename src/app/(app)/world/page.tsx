import { createClient } from "@/lib/supabase/server";
import { loadWorld } from "@/lib/world/storage";
import WorldBoard from "./WorldBoard";

export default async function WorldPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { entries, photoUrls, setupMissing } = await loadWorld(supabase, user!.id);

  return (
    <WorldBoard initialEntries={entries} photoUrls={photoUrls} setupMissing={setupMissing} />
  );
}
