"use server";

import { sendNewsletterSignupEmail } from "@/lib/email";

const RECIPIENT_EMAIL = "info@bubblescarwashcafe.com.au";

export async function subscribeToNewsletter(
  email: string,
): Promise<{ ok: boolean; error?: string }> {
  const trimmed = email.trim();
  if (!trimmed || !trimmed.includes("@")) {
    return { ok: false, error: "Please enter a valid email address." };
  }

  const sent = await sendNewsletterSignupEmail(trimmed, RECIPIENT_EMAIL);
  if (!sent) {
    return { ok: false, error: "Couldn't sign you up right now. Please try again shortly." };
  }
  return { ok: true };
}
