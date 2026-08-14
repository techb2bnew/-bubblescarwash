-- Seeds the wash + detailing feature checklist (from the reference site
-- screenshots) and links the existing Express Wash / Platinum Wash services
-- to a sensible default set of checked features. Safe to run multiple times.

insert into inclusions (category, name, sort_order)
select v.category, v.name, v.sort_order
from (values
  ('wash', 'High-pressure rinse', 1),
  ('wash', 'Exterior wash with pH neutral shampoo', 2),
  ('wash', 'Apply tyre shine', 3),
  ('wash', 'Exterior windows & side mirrors cleaned', 4),
  ('wash', 'Mag wheel wash process', 5),
  ('wash', 'Vacuum interior floor mats & footwells', 6),
  ('wash', 'Vacuum seats & boot', 7),
  ('wash', 'Clean door & boot jambs', 8),
  ('wash', 'Interior windows & mirrors cleaned', 9),
  ('wash', 'Clean dashboard & console', 10),
  ('wash', 'Clean door trims', 11),
  ('wash', 'Remove tar & bugs', 12),
  ('wash', 'Full duco hand wax polish', 13),
  ('wash', 'Clay bar treatment to remove surface contaminants (on assessment of vehicle)', 14),
  ('detailing', 'Leather-seat clean & condition treatment', 1),
  ('detailing', 'Carpet extraction & cloth seat clean', 2),
  ('detailing', 'Clean & condition dashboard & internal trims', 3),
  ('detailing', 'Clay bar treatment to remove surface contaminants (on assessment of vehicle)', 4),
  ('detailing', 'Scratch & swirl mark reduction', 5),
  ('detailing', 'Condition of external trims', 6),
  ('detailing', 'Cup holders & compartments cleaned', 7),
  ('detailing', 'Vinyl surfaces cleaned & dressed', 8),
  ('detailing', 'Door jambs & boot cleaned', 9),
  ('detailing', 'Minor spot buffing, as required', 10),
  ('detailing', 'Paint protection treatment', 11)
) as v(category, name, sort_order)
where not exists (
  select 1 from inclusions i where i.category = v.category and i.name = v.name
);

-- Express Wash: first 4 wash features (matches the reference's Express column)
insert into service_inclusions (service_id, inclusion_id)
select s.id, i.id
from services s
join inclusions i on i.category = 'wash' and i.sort_order <= 4
where s.name = 'Express Wash'
on conflict do nothing;

-- Platinum Wash: everything except the clay bar treatment (row 14)
insert into service_inclusions (service_id, inclusion_id)
select s.id, i.id
from services s
join inclusions i on i.category = 'wash' and i.sort_order <= 13
where s.name = 'Platinum Wash'
on conflict do nothing;
