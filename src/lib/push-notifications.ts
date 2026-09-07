import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";
import { createClient } from "@/lib/supabase/server";

let cachedApp: App | null | undefined;

function getMessagingApp(): App | null {
  if (cachedApp !== undefined) return cachedApp;

  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) {
    cachedApp = null;
    return null;
  }

  const existing = getApps()[0];
  cachedApp = existing ?? initializeApp({ credential: cert({ projectId, clientEmail, privateKey }) });
  return cachedApp;
}

export function isPushConfigured(): boolean {
  return getMessagingApp() !== null;
}

export interface NotifyAdminsInput {
  /** Short machine-readable category, e.g. "booking_created". */
  type: string;
  title: string;
  body: string;
  /** Extra payload (must be string values — FCM data messages require this). */
  data?: Record<string, string>;
}

/**
 * The one entry point for this module — call it from anywhere a
 * notification-worthy event happens. Always persists a `notifications` row;
 * additionally pushes to every registered admin browser when Firebase is
 * configured. Never throws — a failure here should never break the caller.
 */
export async function notifyAdmins(input: NotifyAdminsInput): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.rpc("create_notification", {
      p_type: input.type,
      p_title: input.title,
      p_body: input.body,
      p_data: input.data ?? {},
    });
  } catch (err) {
    console.error("[push-notifications] create_notification failed:", err);
  }

  const app = getMessagingApp();
  if (!app) return; // not configured — the DB record above still happened

  try {
    const supabase = await createClient();
    const { data: tokenRows, error } = await supabase.rpc("get_admin_fcm_tokens");
    if (error) throw new Error(error.message);

    const tokens = ((tokenRows as { token: string }[] | null) ?? []).map((r) => r.token);
    if (tokens.length === 0) return;

    const response = await getMessaging(app).sendEachForMulticast({
      tokens,
      notification: { title: input.title, body: input.body },
      data: input.data,
    });

    const deadTokens = response.responses
      .map((r, i) =>
        !r.success && r.error?.code === "messaging/registration-token-not-registered"
          ? tokens[i]
          : null,
      )
      .filter((t): t is string => t !== null);

    if (deadTokens.length > 0) {
      await supabase.rpc("prune_fcm_tokens", { p_tokens: deadTokens });
    }
  } catch (err) {
    console.error("[push-notifications] send failed:", err);
  }
}
