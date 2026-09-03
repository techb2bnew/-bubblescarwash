import { createClient } from "@/lib/supabase/server";
import type { GiftCard, GiftCardProduct } from "@/lib/types";
import GiftCardsPageClient from "./gift-cards-page-client";

export default async function AdminGiftCardsPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: cards }] = await Promise.all([
    supabase.from("gift_card_products").select("*").order("sort_order"),
    supabase
      .from("gift_cards")
      .select("*, gift_card_products(name)")
      .order("created_at", { ascending: false }),
  ]);

  return (
    <GiftCardsPageClient
      products={(products as GiftCardProduct[]) ?? []}
      cards={(cards as GiftCard[]) ?? []}
    />
  );
}
