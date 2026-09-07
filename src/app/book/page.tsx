import { createClient } from "@/lib/supabase/server";
import type { BlockedDate, BusinessSettings, Extra, VehicleTypeRow } from "@/lib/types";
import { flattenServiceTemplates, type ServiceTemplateRow } from "@/lib/pricing";
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
    getBookingPaymentMode(),
  ]);

  const flatServices = flattenServiceTemplates(
    (services as ServiceTemplateRow[]) ?? [],
  ).sort((a, b) => a.price - b.price);

  return (
    <div className="min-h-screen bg-white px-4 py-10">
      <BookingFlow
        services={flatServices}
        extras={(extras as Extra[]) ?? []}
        vehicleTypes={(vehicleTypes as VehicleTypeRow[]) ?? []}
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
  );
}
