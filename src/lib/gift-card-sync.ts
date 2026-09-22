import { createClient } from "@/lib/supabase/server";
import { sendGiftCardEmail } from "@/lib/email";

export interface GiftCardPurchasedInput {
  giftCardId: string;
  code: string;
  value: number;
  productName: string | null;
  purchaserName: string;
  purchaserEmail: string;
  recipientName: string | null;
  recipientEmail: string | null;
  message: string | null;
  expiresAt: string;
  designSlug?: string | null;
}

/**
 * Called once a gift card purchase is paid (Stripe webhook, or immediately
 * for the simple-form path). Takes the purchase details as input rather
 * than re-querying `gift_cards` — that table has no anon SELECT policy (it
 * holds purchaser/recipient PII and redemption codes), so a re-fetch with
 * the anon-key client would be silently RLS-filtered to nothing. Same
 * reasoning as onBookingCreated() in booking-sync.ts.
 */
export async function onGiftCardPurchased(input: GiftCardPurchasedInput): Promise<void> {
  try {
    const supabase = await createClient();
    const { data: business } = await supabase
      .from("business_settings")
      .select("name")
      .eq("id", 1)
      .single();

    await sendGiftCardEmail({
      code: input.code,
      value: input.value,
      productName: input.productName ?? "Gift Card",
      purchaserName: input.purchaserName,
      purchaserEmail: input.purchaserEmail,
      recipientName: input.recipientName,
      recipientEmail: input.recipientEmail,
      message: input.message,
      expiresAt: input.expiresAt,
      businessName: business?.name ?? "Car Wash",
      designSlug: input.designSlug ?? null,
    });
  } catch (err) {
    console.error("[gift-card-sync] onGiftCardPurchased failed:", err);
  }
}
