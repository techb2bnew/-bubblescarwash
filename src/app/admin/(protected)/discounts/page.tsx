import { createClient } from "@/lib/supabase/server";
import type { Customer, Discount } from "@/lib/types";
import DiscountsPageClient from "./discounts-page-client";

export default async function AdminDiscountsPage() {
  const supabase = await createClient();
  const [{ data: discounts }, { data: customers }] = await Promise.all([
    supabase
      .from("discounts")
      .select("*, customers(name, email)")
      .order("created_at", { ascending: false }),
    supabase.from("customers").select("id, name, phone, email").order("name"),
  ]);

  return (
    <DiscountsPageClient
      discounts={(discounts as Discount[]) ?? []}
      customers={(customers as Pick<Customer, "id" | "name" | "phone" | "email">[]) ?? []}
    />
  );
}
