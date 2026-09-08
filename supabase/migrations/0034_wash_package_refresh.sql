-- Replaces the original 3 wash services (Platinum Wash, Express Wash, Star
-- Polish — Sedan-only pricing) with a 4-tier cumulative wash/detail
-- progression priced across all 4 vehicle types, matching a reference
-- pricing page the client provided. Old services/inclusions are deactivated
-- rather than deleted, so historical bookings referencing them are
-- unaffected. Safe to run multiple times.
--
-- Duration estimates (not specified by the client — adjust in
-- /admin/services if these don't match reality):
--   Outside Wash 30min, Inside & Out Wash 45min, Superior Wash 60min,
--   Mini Detail 180min (reference site notes "allow 1-4 hours" for its
--   equivalent higher-tier detailing services).

-- Retire the old services.
update services
set active = false
where name in ('Platinum Wash', 'Express Wash', 'Star Polish')
  and category = 'wash';

-- Retire the old wash feature checklist (described the retired services).
update inclusions
set active = false
where category = 'wash';

-- New cumulative feature checklist for the 4-tier progression. Each tier's
-- service links to every inclusion up to and including its own tier (see
-- service_inclusions insert below), matching the reference's "Plus:" framing.
insert into inclusions (category, name, sort_order)
select v.category, v.name, v.sort_order
from (values
  ('wash', 'Hand Wash', 101),
  ('wash', 'Chamois Dry', 102),
  ('wash', 'Tyres Glossed', 103),
  ('wash', 'Interior Dusted', 104),
  ('wash', 'Vacuum', 105),
  ('wash', 'Windows', 106),
  ('wash', 'Protective Wax', 107),
  ('wash', 'Door Jambs', 108),
  ('wash', 'Interior Trim Upgrade', 109),
  ('wash', 'Wheels Detailed', 110),
  ('wash', 'Clay Bar', 111),
  ('wash', 'Carpets & Mats Steam Cleaned', 112),
  ('wash', 'Leather Clean & Condition / Seats Steam Cleaned', 113)
) as v(category, name, sort_order)
where not exists (
  select 1 from inclusions i where i.category = v.category and i.name = v.name
);

-- The 4 new packages x 4 vehicle types.
insert into services (name, category, vehicle_type, price, duration_minutes, active)
select v.name, 'wash', v.vehicle_type, v.price, v.duration_minutes, true
from (values
  ('Outside Wash', 'sedan', 40.00, 30),
  ('Outside Wash', 'suv', 45.00, 30),
  ('Outside Wash', 'xlarge', 50.00, 30),
  ('Outside Wash', 'xxl', 55.00, 30),

  ('Inside & Out Wash', 'sedan', 70.00, 45),
  ('Inside & Out Wash', 'suv', 80.00, 45),
  ('Inside & Out Wash', 'xlarge', 90.00, 45),
  ('Inside & Out Wash', 'xxl', 100.00, 45),

  ('Superior Wash', 'sedan', 90.00, 60),
  ('Superior Wash', 'suv', 100.00, 60),
  ('Superior Wash', 'xlarge', 110.00, 60),
  ('Superior Wash', 'xxl', 120.00, 60),

  ('Mini Detail', 'sedan', 349.00, 180),
  ('Mini Detail', 'suv', 379.00, 180),
  ('Mini Detail', 'xlarge', 399.00, 180),
  ('Mini Detail', 'xxl', 419.00, 180)
) as v(name, vehicle_type, price, duration_minutes)
where not exists (
  select 1 from services s
  where s.name = v.name and s.category = 'wash' and s.vehicle_type = v.vehicle_type
);

-- Outside Wash: tier 1 only.
insert into service_inclusions (service_id, inclusion_id)
select s.id, i.id
from services s
join inclusions i on i.category = 'wash' and i.sort_order between 101 and 103
where s.name = 'Outside Wash' and s.category = 'wash'
on conflict do nothing;

-- Inside & Out Wash: tiers 1-2 (cumulative).
insert into service_inclusions (service_id, inclusion_id)
select s.id, i.id
from services s
join inclusions i on i.category = 'wash' and i.sort_order between 101 and 106
where s.name = 'Inside & Out Wash' and s.category = 'wash'
on conflict do nothing;

-- Superior Wash: tiers 1-3 (cumulative).
insert into service_inclusions (service_id, inclusion_id)
select s.id, i.id
from services s
join inclusions i on i.category = 'wash' and i.sort_order between 101 and 110
where s.name = 'Superior Wash' and s.category = 'wash'
on conflict do nothing;

-- Mini Detail: all 4 tiers (cumulative).
insert into service_inclusions (service_id, inclusion_id)
select s.id, i.id
from services s
join inclusions i on i.category = 'wash' and i.sort_order between 101 and 113
where s.name = 'Mini Detail' and s.category = 'wash'
on conflict do nothing;

-- Express Detailing + Full Detailing menus, added as flat-priced Extras
-- (the reference site's "from $X" framing is dropped since Extras only
-- support a single fixed price).
insert into extras (name, description, price, sort_order)
select v.name, null, v.price, v.sort_order
from (values
  ('Protective Wax', 10.00, 201),
  ('Head Light Restoration', 80.00, 202),
  ('Wheels Detailed', 20.00, 203),
  ('Mats Steam Clean', 50.00, 204),
  ('Clay Bar', 40.00, 205),
  ('Hand Wax & Polish', 35.00, 206),
  ('Seats Steam Clean', 120.00, 207),
  ('Carpet Steam Clean', 120.00, 208),
  ('Leather Treatment', 120.00, 209),
  ('Interior Detail', 349.00, 210),
  ('Cut & Polish', 449.00, 211),
  ('Full Detail', 549.00, 212)
) as v(name, price, sort_order)
where not exists (
  select 1 from extras e where e.name = v.name
);

notify pgrst, 'reload schema';
