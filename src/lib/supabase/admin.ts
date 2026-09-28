import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Creating/deleting a staff login or resetting their password requires the
 * Supabase Admin API, which only works with the service-role key (never the
 * anon key) — there's no other way to create an auth user without either
 * emailing them a signup link or briefly hijacking the admin's own session.
 * Self-disabling like the Stripe/Google Calendar/Resend integrations
 * elsewhere in this app: absent key means the feature just isn't set up yet.
 */
export function isServiceRoleConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
}

export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "Staff accounts aren't set up yet — add SUPABASE_SERVICE_ROLE_KEY to the environment (Supabase Dashboard → Settings → API → service_role key).",
    );
  }
  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
