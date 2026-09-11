"use server";

import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import {
  REMEMBER_COOKIE,
  REMEMBER_MAX_AGE,
} from "@/lib/supabase/cookie-lifetime";

/**
 * Sign-in runs on the server so the auth cookies are written by our own
 * cookie handler, which is the only place "Remember me" can be honoured —
 * the browser client stamps its own 400-day lifetime on everything it
 * writes regardless of what it's asked for.
 */
export async function signInAdmin(
  email: string,
  password: string,
  rememberMe: boolean,
): Promise<{ error: string | null }> {
  const cookieStore = await cookies();
  cookieStore.set(REMEMBER_COOKIE, rememberMe ? "1" : "0", {
    path: "/",
    sameSite: "lax",
    maxAge: REMEMBER_MAX_AGE,
  });

  const supabase = await createClient({ rememberMe });
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) return { error: error.message };

  // Signing in only proves the credentials are valid — this app's admin
  // area is gated on admin_users, same check the protected layout makes.
  const { data: adminRow } = await supabase
    .from("admin_users")
    .select("id")
    .eq("id", data.user.id)
    .maybeSingle();
  if (!adminRow) {
    await supabase.auth.signOut();
    return { error: "This account doesn't have admin access." };
  }

  return { error: null };
}
