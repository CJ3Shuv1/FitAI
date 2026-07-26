import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ count: exerciseCount }, { count: bookCount }] = await Promise.all([
    supabase
      .from("exercises")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id),
    supabase
      .from("books")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user!.id),
  ]);

  return (
    <div className="pt-6">
      <div className="mb-1 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
        FitAI
      </div>
      <h1 className="mb-2 text-4xl font-black leading-none tracking-tight">
        Was steht an?
      </h1>
      <p className="mb-8 text-sm text-[var(--text-dim)]">
        Wähl deinen Bereich — du kannst jederzeit wechseln.
      </p>

      <div className="space-y-4">
        <Link
          href="/training"
          className="block overflow-hidden rounded-3xl bg-gradient-to-br from-[var(--copper-dim)] via-[var(--copper)] to-[#B5591F] p-6 transition-transform active:scale-[0.98]"
        >
          <div className="mb-3 text-4xl">🏋️</div>
          <div className="mb-1 text-2xl font-black tracking-tight text-[#1A1209]">
            Training &amp; Ernährung
          </div>
          <p className="text-sm leading-relaxed text-[#1A1209]/75">
            Trainingsplan, Ernährungstagebuch, Rezepte und Einkaufsliste.
          </p>
          <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[#1A1209]/60">
            {exerciseCount ?? 0} Übungen im Plan
          </div>
        </Link>

        <Link
          href="/reading"
          className="block overflow-hidden rounded-3xl bg-gradient-to-br from-[#1F3550] via-[#2A4A6E] to-[#16283D] p-6 transition-transform active:scale-[0.98]"
        >
          <div className="mb-3 text-4xl">📚</div>
          <div className="mb-1 text-2xl font-black tracking-tight text-[#EAF2FB]">
            Mein Regal
          </div>
          <p className="text-sm leading-relaxed text-[#EAF2FB]/70">
            Bücher, die du liest, angefangen hast oder als Nächstes willst — mit
            dem, was hängen bleibt.
          </p>
          <div className="mt-3 font-mono text-[11px] uppercase tracking-[0.1em] text-[#EAF2FB]/50">
            {bookCount ?? 0} Bücher im Regal
          </div>
        </Link>
      </div>
    </div>
  );
}
