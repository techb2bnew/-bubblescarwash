import type { CookieOptions } from "@supabase/ssr";

/**
 * Records whether the admin ticked "Remember me" at sign-in. Written by the
 * login action and read wherever auth cookies get written, so the choice
 * survives every later token refresh rather than only the first response.
 */
export const REMEMBER_COOKIE = "admin_remember";

/** 400 days — the ceiling browsers allow on a cookie's lifetime. */
export const REMEMBER_MAX_AGE = 400 * 24 * 60 * 60;

/**
 * @supabase/ssr always stamps its own 400-day maxAge on the auth cookies
 * (it overrides whatever you pass as cookieOptions.maxAge, see
 * cookies.js: `maxAge: DEFAULT_COOKIE_OPTIONS.maxAge`), so "Remember me"
 * can only be honoured where *we* write the cookie. Dropping maxAge and
 * expires leaves a session cookie, which the browser discards on close —
 * the session itself stays valid server-side, there's just no longer a
 * cookie carrying it.
 */
export function withRememberLifetime(
  options: CookieOptions,
  remember: boolean,
): CookieOptions {
  if (remember) return options;
  const sessionScoped = { ...options };
  delete sessionScoped.maxAge;
  delete sessionScoped.expires;
  return sessionScoped;
}
