import { createClient } from "@/lib/supabase/server";
import type {
  AddOn,
  BlockedDate,
  BusinessSettings,
  CategoryRow,
  Service,
  VehicleTypeRow,
} from "@/lib/types";
import BookingFlow from "./booking-flow";

export default async function BookPage() {
  const supabase = await createClient();

  const [
    { data: services },
    { data: inclusions },
    { data: settings },
    { data: blockedDates },
    { data: vehicleTypes },
    { data: categories },
  ] = await Promise.all([
    supabase
      .from("services")
      .select("*, service_inclusions(inclusion_id)")
      .eq("active", true)
      .order("price"),
    supabase.from("inclusions").select("*").order("category").order("sort_order"),
    supabase.from("business_settings").select("*").eq("id", 1).single(),
    supabase.from("blocked_dates").select("*"),
    supabase.from("vehicle_types").select("*").eq("active", true).order("sort_order"),
    supabase
      .from("service_categories")
      .select("*")
      .eq("active", true)
      .order("sort_order"),
  ]);

  return (
    <div className="min-h-screen bg-white px-4 py-10">
      <BookingFlow
        services={(services as Service[]) ?? []}
        inclusions={(inclusions as AddOn[]) ?? []}
        vehicleTypes={(vehicleTypes as VehicleTypeRow[]) ?? []}
        categories={(categories as CategoryRow[]) ?? []}
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
