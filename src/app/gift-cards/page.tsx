import { createClient } from "@/lib/supabase/server";
import type { GiftCardProduct } from "@/lib/types";
import SiteHeader from "../_components/site-header";
import SiteFooter from "../_components/site-footer";
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
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />
      <main className="flex-1 bg-gray-50 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
            Gift Vouchers
          </span>
          <h1 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
            A Great Gift For Someone Special
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Covers a wash, a detail, or a coffee at the cafe.
          </p>
        </div>
        <div className="mt-10 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-8">
          <GiftCardFlow
            products={(products as GiftCardProduct[]) ?? []}
            paymentMode={paymentMode}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
