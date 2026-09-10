/** Slug of a vehicle_types row (e.g. "sedan"). Values are admin-managed, not fixed. */
export type VehicleType = string;
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

/** An admin-managed grouping for services (e.g. "Wash", "Detailing"). */
export interface ServiceCategoryRow {
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

/** Recurring hours for one day of the week. day_of_week: 0 = Sunday … 6 = Saturday. */
export interface WeekdayHours {
  day_of_week: number;
  opening_time: string;
  closing_time: string;
}

/** Which rule supplied a date's effective hours, most specific first. */
export type HoursSource = "date" | "weekday" | "default";

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
  vehicle_type: VehicleType;
  category_id: string;
  price: number;
  duration_minutes: number;
  active: boolean;
  created_at: string;
  inclusions?: AddOn[];
}

/** One vehicle type's price under a service template. */
export interface ServicePrice {
  id: string;
  service_id: string;
  vehicle_type: VehicleType;
  price: number;
}

/**
 * A service as managed on the admin Services page: one entity with a price
 * per vehicle type, shown as a single row. `Service` above is the
 * flattened, one-row-per-vehicle-type shape used everywhere else (booking
 * flows, bookings table, analytics).
 */
export interface ServiceTemplate {
  id: string;
  name: string;
  category_id: string;
  duration_minutes: number;
  active: boolean;
  created_at: string;
  prices: ServicePrice[];
  inclusions?: AddOn[];
}

/** An add-on/feature that belongs to one specific service (e.g. "Interior Vacuum"). */
export interface AddOn {
  id: string;
  service_id: string;
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

export type GiftCardStatus = "pending" | "active" | "used" | "cancelled";

/** Admin-managed purchasable gift card denomination. */
export interface GiftCardProduct {
  id: string;
  name: string;
  description: string | null;
  price: number;
  validity_days: number;
  sort_order: number;
  active: boolean;
  created_at: string;
}

/** A purchased gift card instance. */
export interface GiftCard {
  id: string;
  product_id: string | null;
  code: string;
  value: number;
  purchaser_name: string;
  purchaser_email: string;
  purchaser_phone: string | null;
  recipient_name: string | null;
  recipient_email: string | null;
  message: string | null;
  status: GiftCardStatus;
  payment_status: PaymentStatus;
  stripe_checkout_session_id: string | null;
  stripe_payment_intent_id: string | null;
  card_brand: string | null;
  card_last4: string | null;
  receipt_url: string | null;
  expires_at: string;
  redeemed_at: string | null;
  redeemed_booking_id: string | null;
  created_at: string;
  gift_card_products?: { name: string } | null;
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
  vehicle_type: string;
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
  card_brand: string | null;
  card_last4: string | null;
  receipt_url: string | null;
  gift_card_id: string | null;
  gift_card_discount: number;
  discount_id: string | null;
  discount_amount: number;
  google_event_id: string | null;
  created_at: string;
  services?: Service;
  booking_extras?: BookingExtra[];
}

/** A managed row in the `customers` table (the admin-editable directory). */
export interface Customer {
  id: string;
  name: string;
  phone: string;
  email: string;
  created_at: string;
  updated_at: string;
}

export interface CustomerSummary {
  key: string;
  /** The `customers` row id, or null for a booking-derived entry with no matching row (edit/delete unavailable). */
  id: string | null;
  name: string;
  phone: string;
  email: string;
  bookingsCount: number;
  totalSpent: number;
  /** Empty string if the customer has no bookings yet. */
  lastVisit: string;
  bookings: Booking[];
}

export type DiscountType = "percent" | "fixed";

/**
 * Either assigned to one customer (auto-applied when their email/phone
 * matches at checkout — `customer_id` set, `code` null) or issued as a
 * public coupon (redeemed by typing the code — `code` set, `customer_id`
 * null), never both.
 */
export interface Discount {
  id: string;
  name: string;
  discount_type: DiscountType;
  value: number;
  code: string | null;
  customer_id: string | null;
  max_redemptions: number | null;
  redemption_count: number;
  per_customer_limit: number | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  customers?: { name: string; email: string } | null;
}
