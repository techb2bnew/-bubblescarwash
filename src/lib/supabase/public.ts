import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Plain (cookie-free) Supabase client for public, read-only data (pricing,
 * categories, etc.) used on marketing pages. Unlike the cookie-aware server
 * client, this doesn't call `cookies()`, so pages using it can still be
 * statically generated / ISR-cached instead of rendering fully dynamic on
 * every request.
 */
export function createPublicClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
