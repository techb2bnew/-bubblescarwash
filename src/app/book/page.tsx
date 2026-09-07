import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import type {
  AddOn,
  BlockedDate,
  BusinessSettings,
  CategoryRow,
  Extra,
  Service,
  VehicleTypeRow,
} from "@/lib/types";
import SiteHeader from "../_components/site-header";
import SiteFooter from "../_components/site-footer";
import TypewriterWord from "../_components/typewriter-word";
import MarqueeBand from "../_components/marquee-band";
import { getBookingPaymentMode } from "./actions";
import BookingFlow from "./booking-flow";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const supabase = await createClient();

  const [
    { data: services },
    { data: inclusions },
    { data: extras },
    { data: settings },
    { data: blockedDates },
    { data: vehicleTypes },
    { data: categories },
    paymentMode,
  ] = await Promise.all([
    supabase
      .from("services")
      .select("*, service_inclusions(inclusion_id)")
      .eq("active", true)
      .order("price"),
    supabase.from("inclusions").select("*").order("category").order("sort_order"),
    supabase.from("extras").select("*").eq("active", true).order("sort_order"),
    supabase.from("business_settings").select("*").eq("id", 1).single(),
    supabase.from("blocked_dates").select("*"),
    supabase.from("vehicle_types").select("*").eq("active", true).order("sort_order"),
    supabase
      .from("service_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
    getBookingPaymentMode(),
  ]);

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />

      <section className="relative isolate overflow-hidden">
        <div className="relative h-56 w-full sm:h-64">
          <Image
            src="/real-photos/hero-carwash.jpg"
            alt="High-pressure rinse spraying down a car windscreen"
            fill
            sizes="100vw"
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0b1220] via-[#0b1220]/80 to-[#0b1220]/40" />
          <div className="absolute inset-0 flex flex-col items-center justify-center px-4 text-center text-white">
            <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-300 ring-1 ring-white/10">
              Book Online
            </span>
            <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
              Reserve Your <TypewriterWord text="Wash" className="wave-word wave-word-dark" />
            </h1>
            <p className="mt-2 max-w-md text-sm text-gray-300">
              Pick your vehicle, service and a time that suits you.
            </p>
          </div>
        </div>
      </section>

      <MarqueeBand />

      <main className="relative flex-1 overflow-hidden bg-gray-50 px-4 py-12 sm:py-16">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-3xl rounded-3xl bg-white p-5 shadow-xl shadow-gray-900/5 ring-1 ring-gray-100 sm:p-8">
          <BookingFlow
            services={(services as Service[]) ?? []}
            inclusions={(inclusions as AddOn[]) ?? []}
            extras={(extras as Extra[]) ?? []}
            vehicleTypes={(vehicleTypes as VehicleTypeRow[]) ?? []}
            categories={(categories as CategoryRow[]) ?? []}
            paymentMode={paymentMode}
            settings={(settings as BusinessSettings) ?? {
              id: 1,
              name: "Car Wash",
              address: null,
              phone: null,
              email: null,
              opening_time: "09:00",
              closing_time: "17:00",
              slot_interval_minutes: 30,
            }}
            blockedDates={(blockedDates as BlockedDate[]) ?? []}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
