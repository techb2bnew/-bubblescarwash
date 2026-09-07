-- Categories are gone: services are now organized by vehicle type only.
-- Add-ons (the `inclusions` table, labeled "Add-Ons" in the admin panel)
-- move from being shared per-category to belonging directly to one
-- service. Existing category/add-on data doesn't carry over cleanly into
-- that shape (a shared category checklist can't be split into "belongs to
-- exactly one service" automatically) — confirmed with the client to clear
-- it and re-add add-ons per service going forward.

drop table if exists service_inclusions;

truncate inclusions;

alter table inclusions drop column category;
alter table inclusions add column service_id uuid not null references services (id) on delete cascade;

create index if not exists inclusions_service_id_idx on inclusions (service_id);

alter table services drop column category;

drop table if exists service_categories;

notify pgrst, 'reload schema';
