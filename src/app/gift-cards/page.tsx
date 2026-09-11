import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import type { GiftCardProduct } from "@/lib/types";
import { MIN_GIFT_CARD_AMOUNT } from "@/lib/gift-card-designs";
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
      .gte("price", MIN_GIFT_CARD_AMOUNT)
      .order("price"),
    getGiftCardPaymentMode(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />

      <section className="relative isolate overflow-hidden">
        <div className="relative h-56 w-full sm:h-64">
          <Image
            src="/real-photos/gift-voucher.jpg"
            alt="Wrapped gift box tied with a ribbon"
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/80 to-[#0b1220]/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-white/10">
              Gift Vouchers
            </span>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              A Great Gift For Someone <span className="wave-word wave-word-dark">Special</span>
            </h1>
            <p className="mt-2 max-w-md text-sm text-gray-300">
              Covers a wash, a detail, or a coffee at the cafe.
            </p>
          </div>
        </div>
      </section>


      <main className="flex-1 bg-gray-50 px-4 py-12 sm:py-16">
        <div className="rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-8">
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
