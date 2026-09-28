-- Client feedback: booking slots were every 30 minutes (8:00, 8:30, 9:00...);
-- they only want the on-the-hour slots, i.e. a 1-hour interval.
update business_settings set slot_interval_minutes = 60 where id = 1;
