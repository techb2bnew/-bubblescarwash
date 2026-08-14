-- Lets admins hide a feature from the comparison table without deleting it.
alter table inclusions add column if not exists active boolean not null default true;
