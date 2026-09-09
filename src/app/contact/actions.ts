"use server";

import { sendContactEnquiryEmail } from "@/lib/email";

const RECIPIENT_EMAIL = "rishavbase2brand@gmail.com";

export async function submitContactEnquiry(formData: {
  name: string;
  phone: string;
  email: string;
  service: string;
  message: string;
}): Promise<{ ok: boolean; error?: string }> {
  const name = formData.name.trim();
  const phone = formData.phone.trim();
  const email = formData.email.trim();
  const message = formData.message.trim();

  if (!name || !phone || !email || !message) {
    return { ok: false, error: "Please fill out all required fields." };
  }

  const sent = await sendContactEnquiryEmail(
    { name, phone, email, service: formData.service.trim() || null, message },
    RECIPIENT_EMAIL,
  );

  if (!sent) {
    return { ok: false, error: "Couldn't send your message right now. Please try again shortly." };
  }
  return { ok: true };
}
