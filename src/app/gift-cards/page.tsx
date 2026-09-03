import { createClient } from "@/lib/supabase/server";
import type { GiftCardProduct } from "@/lib/types";
import { getGiftCardPaymentMode } from "./actions";
import GiftCardFlow from "./gift-card-flow";

export const dynamic = "force-dynamic";

export default async function GiftCardsPage() {
  const supabase = await createClient();

  const [{ data: products }, paymentMode] = await Promise.all([
    supabase
      .from("gift_card_products")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    getGiftCardPaymentMode(),
  ]);

  return (
    <div className="min-h-screen bg-white px-4 py-10">
      <GiftCardFlow
        products={(products as GiftCardProduct[]) ?? []}
        paymentMode={paymentMode}
      />
    </div>
  );
}
