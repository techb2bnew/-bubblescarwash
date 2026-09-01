-- Store Google Calendar event id for blocked whole days so we can remove them when reopened.

alter table blocked_dates
  add column if not exists google_event_id text;
