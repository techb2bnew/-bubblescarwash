import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { REMEMBER_COOKIE, withRememberLifetime } from "./cookie-lifetime";
import { moduleForPathname } from "@/lib/permission-modules";

const ADMIN_AUTH_PAGES = ["/admin/login", "/admin/forgot-password", "/admin/reset-password"];

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const remember = request.cookies.get(REMEMBER_COOKIE)?.value === "1";

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
            request.cookies.set(name, value),
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(
              name,
              value,
              withRememberLifetime(options, remember),
            ),
          );
        },
      },
    },
  );

  // Refresh the session if expired - required for Server Components.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtectedAdminPath =
    pathname.startsWith("/admin") && !ADMIN_AUTH_PAGES.includes(pathname);

  if (user && isProtectedAdminPath) {
    const { data: adminRow } = await supabase
      .from("admin_users")
      .select("role")
      .eq("id", user.id)
      .maybeSingle();

    if (adminRow?.role === "staff" && pathname !== "/admin") {
      // /admin/permissions has no module row at all (moduleForPathname
      // returns null) — that's deliberate, staff can never reach it. Any
      // other unmatched module also fails closed.
      const moduleKey = moduleForPathname(pathname);
      const allowed = moduleKey
        ? Boolean(
            (
              await supabase
                .from("staff_permissions")
                .select("can_view")
                .eq("module", moduleKey)
                .maybeSingle()
            ).data?.can_view,
          )
        : false;

      if (!allowed) {
        // Carries over any session-refresh cookies queued onto supabaseResponse
        // above — redirecting with a bare NextResponse.redirect() would drop them.
        const redirectResponse = NextResponse.redirect(new URL("/admin", request.url));
        supabaseResponse.cookies.getAll().forEach((cookie) => {
          redirectResponse.cookies.set(cookie);
        });
        return redirectResponse;
      }
    }
  }

  return supabaseResponse;
}
