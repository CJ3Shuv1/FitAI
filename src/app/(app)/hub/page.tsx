import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export default async function HubPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [{ count: exerciseCount }, { count: nutritionCount }, { count: bookCount }, { count: sleepCount }] =
    await Promise.all([
      supabase
        .from("exercises")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id),
      supabase
        .from("nutrition_entries")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id),
      supabase
        .from("books")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id),
      supabase
        .from("sleep_log")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user!.id),
    ]);

  return (
    <div className="flex h-[calc(100dvh-6.5rem)] flex-col pt-3">
      <div className="mb-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--text-faint)]">
        FitAI
      </div>
      <h1 className="mb-1 text-[28px] font-black leading-none tracking-tight">
        Was steht an?
      </h1>
      <p className="mb-4 text-[13px] text-[var(--text-dim)]">
        Wähl deinen Bereich.
      </p>

      <div className="grid flex-1 grid-cols-2 gap-2.5">
        <HubTile
          href="/training"
          emoji="🏋️"
          title="Training"
          stat={`${exerciseCount ?? 0} Übungen`}
          className="bg-gradient-to-br from-[var(--copper-dim)] via-[var(--copper)] to-[#B5591F]"
          textClass="text-[#1A1209]"
          statClass="text-[#1A1209]/60"
        />
        <HubTile
          href="/nutrition"
          emoji="🍽"
          title="Ernährung"
          stat={`${nutritionCount ?? 0} Tage`}
          className="bg-gradient-to-br from-[#2F5C42] via-[#3F7A56] to-[#20402C]"
          textClass="text-[#EAF7EE]"
          statClass="text-[#EAF7EE]/55"
        />
        <HubTile
          href="/reading"
          emoji="📚"
          title="Bücher"
          stat={`${bookCount ?? 0} im Regal`}
          className="bg-gradient-to-br from-[#1F3550] via-[#2A4A6E] to-[#16283D]"
          textClass="text-[#EAF2FB]"
          statClass="text-[#EAF2FB]/50"
        />
        <HubTile
          href="/sleep"
          emoji="🌙"
          title="Schlaf"
          stat={`${sleepCount ?? 0} Nächte`}
          className="bg-gradient-to-br from-[#2E2A4A] via-[#403A66] to-[#211D38]"
          textClass="text-[#EDEAF9]"
          statClass="text-[#EDEAF9]/50"
        />
        <Link
          href="/analysis"
          className="col-span-2 flex items-center gap-3 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] px-4 py-3.5 transition-transform active:scale-[0.98]"
        >
          <span className="text-2xl">📊</span>
          <div className="min-w-0">
            <div className="text-base font-black tracking-tight">Gesamtanalyse</div>
            <div className="truncate text-[11.5px] text-[var(--text-faint)]">
              KI-Blick über alle Bereiche zusammen
            </div>
          </div>
        </Link>
      </div>
    </div>
  );
}

function HubTile({
  href,
  emoji,
  title,
  stat,
  className,
  textClass,
  statClass,
}: {
  href: string;
  emoji: string;
  title: string;
  stat: string;
  className: string;
  textClass: string;
  statClass: string;
}) {
  return (
    <Link
      href={href}
      className={`flex flex-col justify-between overflow-hidden rounded-2xl p-4 transition-transform active:scale-[0.98] ${className}`}
    >
      <span className="text-[26px] leading-none">{emoji}</span>
      <div>
        <div className={`mb-0.5 text-lg font-black leading-tight tracking-tight ${textClass}`}>
          {title}
        </div>
        <div className={`font-mono text-[10px] uppercase tracking-[0.08em] ${statClass}`}>
          {stat}
        </div>
      </div>
    </Link>
  );
}
