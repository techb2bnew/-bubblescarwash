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
      <main className="flex-1 bg-gray-50 px-4 py-12 sm:py-16">
        <div className="mx-auto max-w-2xl text-center">
          <span className="inline-flex items-center gap-2 rounded-full bg-brand-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-brand-600">
            Book Online
          </span>
          <h1 className="mt-3 text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Reserve Your Wash
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Pick your vehicle, service and a time that suits you.
          </p>
        </div>
        <div className="mt-10 rounded-3xl bg-white p-5 shadow-sm ring-1 ring-gray-100 sm:p-8">
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
