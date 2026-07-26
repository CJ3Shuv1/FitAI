import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { isProfileComplete, type Profile } from "@/lib/types";

const PUBLIC_PATHS = ["/login", "/signup", "/auth"];
// The body-measurement onboarding only gates the fitness side — the hub and
// the reading module work fine without a weight/height profile.
const ONBOARDING_EXEMPT_PATHS = [
  "/settings",
  "/login",
  "/signup",
  "/auth",
  "/hub",
  "/reading",
  "/analysis",
];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path.startsWith(p));

  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  if (user && (path === "/login" || path === "/signup")) {
    const url = request.nextUrl.clone();
    url.pathname = "/hub";
    return NextResponse.redirect(url);
  }

  const isOnboardingExempt = ONBOARDING_EXEMPT_PATHS.some((p) => path.startsWith(p));
  if (user && !isOnboardingExempt) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();

    if (!isProfileComplete(profile as Profile | null)) {
      const url = request.nextUrl.clone();
      url.pathname = "/settings";
      url.searchParams.set("onboarding", "1");
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
