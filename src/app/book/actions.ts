"use server";

import { onBookingCreated } from "@/lib/booking-sync";
import { createClient } from "@/lib/supabase/server";

export interface BookedTime {
  time: string;
  reason: string | null;
  isBlocked: boolean;
}

export async function getBookedTimes(date: string): Promise<BookedTime[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booked_times", {
    target_date: date,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map(
    (b: { booking_time: string; reason: string | null; is_blocked: boolean }) => ({
      time: b.booking_time.slice(0, 5),
      reason: b.reason,
      isBlocked: b.is_blocked,
    }),
  );
}

export async function getDateHours(
  date: string,
): Promise<{ openingTime: string; closingTime: string }> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .rpc("get_business_hours", { target_date: date })
    .single();
  if (error) throw new Error(error.message);
  const row = data as { opening_time: string; closing_time: string };
  return {
    openingTime: row.opening_time.slice(0, 5),
    closingTime: row.closing_time.slice(0, 5),
  };
}

export async function countBookingsByEmail(email: string): Promise<number> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("count_bookings_by_email", {
    p_email: email,
  });
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

export interface CreateBookingInput {
  service_id: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
  extra_ids?: string[];
}

export async function createBooking(input: CreateBookingInput) {
  const supabase = await createClient();

  const { data, error } = await supabase.rpc("create_booking", {
    p_service_id: input.service_id,
    p_booking_date: input.booking_date,
    p_booking_time: input.booking_time,
    p_customer_name: input.customer_name,
    p_customer_phone: input.customer_phone,
    p_customer_email: input.customer_email,
    p_extra_ids: input.extra_ids ?? [],
  });
  if (error) throw new Error(error.message);

  const bookingId = data as string;
  await onBookingCreated({
    bookingId,
    serviceId: input.service_id,
    customerName: input.customer_name,
    customerPhone: input.customer_phone,
    customerEmail: input.customer_email,
    bookingDate: input.booking_date,
    bookingTime: input.booking_time,
  });

  return { id: bookingId };
}
