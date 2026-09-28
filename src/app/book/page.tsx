import { createClient } from "@/lib/supabase/server";
import { getBusinessTimezone } from "@/lib/google-calendar";
import type { BlockedDate, BusinessSettings, Extra, ServiceCategoryRow, VehicleTypeRow } from "@/lib/types";
import { flattenServiceTemplates, type ServiceTemplateRow } from "@/lib/pricing";
import SiteHeader from "../_components/site-header";
import SiteFooter from "../_components/site-footer";
import { getBookingPaymentMode } from "./actions";
import BookingFlow from "./booking-flow";

export const dynamic = "force-dynamic";

export default async function BookPage() {
  const supabase = await createClient();

  const [
    { data: services },
    { data: extras },
    { data: settings },
    { data: blockedDates },
    { data: vehicleTypes },
    { data: categories },
    paymentMode,
  ] = await Promise.all([
    supabase
      .from("services")
      .select("*, prices:service_prices(*), inclusions(*)")
      .eq("active", true)
      .order("name"),
    supabase.from("extras").select("*").eq("active", true).order("sort_order"),
    supabase.from("business_settings").select("*").eq("id", 1).single(),
    supabase.from("blocked_dates").select("*"),
    supabase.from("vehicle_types").select("*").eq("active", true).order("sort_order"),
    supabase.from("service_categories").select("*").eq("active", true).order("sort_order"),
    getBookingPaymentMode(),
  ]);

  const flatServices = flattenServiceTemplates(
    (services as ServiceTemplateRow[]) ?? [],
  ).sort((a, b) => a.price - b.price);

  return (
    <div className="flex min-h-screen flex-col bg-white text-gray-900">
      <SiteHeader />

      <main className="relative flex-1 overflow-hidden bg-gray-50 px-4 py-12 sm:py-16">
        <div className="pointer-events-none absolute -top-24 left-1/2 h-72 w-72 -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
        <div className="relative mx-auto max-w-5xl rounded-3xl bg-white p-5 shadow-2xl shadow-gray-900/10 ring-1 ring-gray-100 sm:p-8">
          <BookingFlow
            services={flatServices}
            extras={(extras as Extra[]) ?? []}
            vehicleTypes={(vehicleTypes as VehicleTypeRow[]) ?? []}
            categories={(categories as ServiceCategoryRow[]) ?? []}
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
            businessTimezone={getBusinessTimezone()}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
