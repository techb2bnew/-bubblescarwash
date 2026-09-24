import { createClient } from "@/lib/supabase/server";
import { getAdminRole, getStaffPermissions, hasPermission } from "@/lib/admin-role";
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
    { data: carBookings },
    role,
    permissions,
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
    // Car numbers per customer, so the "Existing customer" search can match
    // "HR 0202" the same way it matches a name/phone/email — bookings has
    // no customer_id FK, so this is joined by email/phone below rather than
    // through the query itself.
    supabase
      .from("bookings")
      .select("customer_email, customer_phone, car_number")
      .not("car_number", "is", null),
    getAdminRole(),
    getStaffPermissions(),
  ]);

  const carsByEmail = new Map<string, Set<string>>();
  const carsByPhone = new Map<string, Set<string>>();
  for (const b of carBookings ?? []) {
    const car = (b as { car_number: string | null }).car_number;
    if (!car) continue;
    const email = (b as { customer_email: string }).customer_email?.toLowerCase();
    const phone = (b as { customer_phone: string }).customer_phone;
    if (email) {
      if (!carsByEmail.has(email)) carsByEmail.set(email, new Set());
      carsByEmail.get(email)!.add(car);
    }
    if (phone) {
      if (!carsByPhone.has(phone)) carsByPhone.set(phone, new Set());
      carsByPhone.get(phone)!.add(car);
    }
  }
  const customersWithCars = ((customers as Pick<Customer, "id" | "name" | "phone" | "email">[]) ?? []).map(
    (c) => ({
      ...c,
      carNumbers: Array.from(
        new Set([
          ...(carsByEmail.get(c.email.toLowerCase()) ?? []),
          ...(carsByPhone.get(c.phone) ?? []),
        ]),
      ),
    }),
  );

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
        customers={customersWithCars}
        extras={(extras as Extra[]) ?? []}
        categories={(categories as ServiceCategoryRow[]) ?? []}
        googleCalendarEmbedUrl={googleCalendarEmbedUrl}
        paymentMode={getPaymentMode()}
        canEdit={hasPermission(role, permissions, "calendar", "create")}
      />
    </div>
  );
}
