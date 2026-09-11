import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { REMEMBER_COOKIE, withRememberLifetime } from "./cookie-lifetime";

export async function createClient(options?: { rememberMe?: boolean }) {
  const cookieStore = await cookies();
  // The login action knows the choice directly; every other request reads it
  // back off the cookie it wrote.
  const remember =
    options?.rememberMe ?? cookieStore.get(REMEMBER_COOKIE)?.value === "1";

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, withRememberLifetime(options, remember)),
            );
          } catch {
            // setAll called from a Server Component; ignore if middleware
            // is refreshing the session.
          }
        },
      },
    },
  );
}
