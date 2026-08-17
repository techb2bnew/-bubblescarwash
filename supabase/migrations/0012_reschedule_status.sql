-- Adds a "rescheduled" booking status so admins can flag a booking whose
-- date/time was moved, distinct from a fresh "confirmed" booking.

alter table bookings drop constraint if exists bookings_status_check;
alter table bookings add constraint bookings_status_check
  check (status in ('confirmed', 'cancelled', 'completed', 'rescheduled'));
