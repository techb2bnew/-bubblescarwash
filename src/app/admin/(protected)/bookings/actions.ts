"use server";

import { revalidatePath } from "next/cache";
import { onBookingCancelled, onBookingRescheduled } from "@/lib/booking-sync";
import { createClient } from "@/lib/supabase/server";
import type { BookingStatus } from "@/lib/types";

export async function setBookingStatus(id: string, status: BookingStatus) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({ status })
    .eq("id", id);
  if (error) throw new Error(error.message);

  if (status === "cancelled") {
    await onBookingCancelled(id);
  }

  revalidatePath("/admin/bookings");
}

export async function rescheduleBooking(
  id: string,
  bookingDate: string,
  bookingTime: string,
) {
  const supabase = await createClient();
  const { error } = await supabase
    .from("bookings")
    .update({
      booking_date: bookingDate,
      booking_time: bookingTime,
      status: "rescheduled",
    })
    .eq("id", id);
  if (error) throw new Error(error.message);

  await onBookingRescheduled(id);

  revalidatePath("/admin/bookings");
}
