import { createClient } from "@/lib/supabase/server";
import { syncBlockedDatesToGoogle } from "@/lib/blocked-date-sync";
import { syncBlockedSlotsToGoogle } from "@/lib/blocked-slot-sync";
import { getGoogleCalendarEmbedUrl } from "@/lib/google-calendar";
import { getPaymentMode } from "@/lib/payment-mode";
import { flattenServiceTemplates, type ServiceTemplateRow } from "@/lib/pricing";
import type {
  BlockedDate,
  BusinessSettings,
  Customer,
  Extra,
  ServiceCategoryRow,
  VehicleTypeRow,
} from "@/lib/types";
import CalendarView from "./calendar-view";

export const dynamic = "force-dynamic";

export default async function AdminCalendarPage() {
  await Promise.all([
    syncBlockedDatesToGoogle(),
    syncBlockedSlotsToGoogle(),
  ]);

  const supabase = await createClient();
  const [
    { data: blockedDates },
    { data: settings },
    { data: services },
    { data: vehicleTypes },
    { data: customers },
    { data: extras },
    { data: categories },
  ] = await Promise.all([
    supabase.from("blocked_dates").select("*").order("date"),
    supabase.from("business_settings").select("*").eq("id", 1).single(),
    supabase
      .from("services")
      .select("*, prices:service_prices(*)")
      .eq("active", true)
      .order("name"),
    supabase.from("vehicle_types").select("*").eq("active", true).order("sort_order"),
    supabase.from("customers").select("id, name, phone, email").order("name"),
    supabase.from("extras").select("*").eq("active", true).order("sort_order"),
    supabase.from("service_categories").select("*").eq("active", true).order("sort_order"),
  ]);

  const googleCalendarEmbedUrl = getGoogleCalendarEmbedUrl("WEEK");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Calendar</h1>
        <p className="mt-1 text-sm text-gray-500">
          View bookings on Google Calendar and create bookings below. Booth
          capacity, hours, and blocked dates/slots are managed from Set
          Operations in the sidebar.
        </p>
      </div>
      <CalendarView
        blockedDates={(blockedDates as BlockedDate[]) ?? []}
        settings={settings as BusinessSettings}
        services={flattenServiceTemplates((services as ServiceTemplateRow[]) ?? [])}
        vehicleTypes={(vehicleTypes as VehicleTypeRow[]) ?? []}
        customers={(customers as Pick<Customer, "id" | "name" | "phone" | "email">[]) ?? []}
        extras={(extras as Extra[]) ?? []}
        categories={(categories as ServiceCategoryRow[]) ?? []}
        googleCalendarEmbedUrl={googleCalendarEmbedUrl}
        paymentMode={getPaymentMode()}
      />
    </div>
  );
}
