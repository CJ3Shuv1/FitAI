import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { signOut } from "@/app/auth/actions";
import { themeCssVars } from "@/lib/themes";
import AppNav from "./AppNav";
import type { CSSProperties } from "react";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: settings } = await supabase
    .from("user_settings")
    .select("theme")
    .eq("user_id", user.id)
    .maybeSingle();

  const style = themeCssVars(settings?.theme ?? "copper") as CSSProperties;

  return (
    <div
      style={style}
      className="mx-auto flex min-h-screen w-full max-w-[560px] flex-col bg-[var(--bg)]"
    >
      <AppNav />

      <main className="flex-1 px-4 pb-10 pt-2">{children}</main>

      <div className="px-4 pb-6 text-center">
        <form action={signOut}>
          <button
            type="submit"
            className="font-mono text-[10.5px] text-[var(--text-faint)] underline"
          >
            Abmelden ({user.email})
          </button>
        </form>
      </div>
    </div>
  );
}
