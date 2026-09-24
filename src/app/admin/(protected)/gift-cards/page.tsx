import { createClient } from "@/lib/supabase/server";
import { getAdminRole, getStaffPermissions, hasPermission } from "@/lib/admin-role";
import type { GiftCard, GiftCardProduct } from "@/lib/types";
import GiftCardsPageClient from "./gift-cards-page-client";

export default async function AdminGiftCardsPage() {
  const supabase = await createClient();
  const [{ data: products }, { data: cards }, role, permissions] = await Promise.all([
    supabase.from("gift_card_products").select("*").order("sort_order"),
    supabase
      .from("gift_cards")
      .select("*, gift_card_products(name)")
      .order("created_at", { ascending: false }),
    getAdminRole(),
    getStaffPermissions(),
  ]);

  return (
    <GiftCardsPageClient
      products={(products as GiftCardProduct[]) ?? []}
      cards={(cards as GiftCard[]) ?? []}
      canCreate={hasPermission(role, permissions, "gift_cards", "create")}
      canEdit={hasPermission(role, permissions, "gift_cards", "edit")}
      canDelete={hasPermission(role, permissions, "gift_cards", "delete")}
    />
  );
}
