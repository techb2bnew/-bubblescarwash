"use server";

import { createClient } from "@/lib/supabase/server";

export interface BookedTime {
  time: string;
  reason: string | null;
}

export async function getBookedTimes(date: string): Promise<BookedTime[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_booked_times", {
    target_date: date,
  });
  if (error) throw new Error(error.message);
  return (data ?? []).map((b: { booking_time: string; reason: string | null }) => ({
    time: b.booking_time.slice(0, 5),
    reason: b.reason,
  }));
}

export interface CreateBookingInput {
  service_id: string;
  booking_date: string;
  booking_time: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string;
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
  });
  if (error) throw new Error(error.message);
  return { id: data as string };
}
