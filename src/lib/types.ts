/** Slug of a vehicle_types row (e.g. "sedan"). Values are admin-managed, not fixed. */
export type VehicleType = string;
/** Slug of a service_categories row (e.g. "wash"). Values are admin-managed, not fixed. */
export type ServiceCategory = string;
export type BookingStatus =
  | "confirmed"
  | "cancelled"
  | "completed"
  | "rescheduled";

export interface VehicleTypeRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  sort_order: number;
  active: boolean;
}

export interface BusinessSettings {
  id: number;
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  opening_time: string;
  closing_time: string;
  slot_interval_minutes: number;
  default_booth_count: number;
}

export type BoothCapacityDuration = "day" | "week" | "month" | "ongoing";

export interface BoothCapacityPeriod {
  id: string;
  start_date: string;
  end_date: string;
  booth_count: number;
  created_at: string;
}

export interface Service {
  id: string;
  name: string;
  category: ServiceCategory;
  vehicle_type: VehicleType;
  price: number;
  duration_minutes: number;
  active: boolean;
  created_at: string;
  service_inclusions?: { inclusion_id: string }[];
}

export interface AddOn {
  id: string;
  category: ServiceCategory;
  name: string;
  sort_order: number;
  active: boolean;
}

/** Priced optional extra, selectable during booking (e.g. "Mag wheel detail — $20"). */
export interface Extra {
  id: string;
  name: string;
  description: string | null;
  price: number;
  sort_order: number;
  active: boolean;
  created_at: string;
}

/** Snapshot of an extra's name/price at the time it was added to a booking. */
export interface BookingExtra {
  id: string;
  booking_id: string;
  extra_id: string | null;
  name: string;
  price: number;
  created_at: string;
}

export interface BlockedDate {
  id: string;
  date: string;
  reason: string | null;
  google_event_id: string | null;
  created_at: string;
}

export interface BlockedSlot {
  id: string;
  date: string;
  time: string;
  reason: string | null;
  google_event_id: string | null;
  created_at: string;
}

export type BookingType = "online" | "offline";

export type PaymentStatus = "unpaid" | "pending" | "paid" | "failed" | "refunded";

export interface Booking {
  id: string;
  service_id: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  booking_date: string;
  booking_time: string;
  status: BookingStatus;
  booking_type: BookingType;
  price: number | null;
  payment_status: PaymentStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  google_event_id: string | null;
  created_at: string;
  services?: Service;
  booking_extras?: BookingExtra[];
}

export interface CustomerSummary {
  key: string;
  name: string;
  phone: string;
  email: string;
  bookingsCount: number;
  totalSpent: number;
  lastVisit: string;
  bookings: Booking[];
}
