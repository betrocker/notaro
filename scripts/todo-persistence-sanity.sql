-- Todo persistence sanity checks (run in Supabase SQL Editor).
-- Verifies that deadline/checklist are stored in dedicated columns
-- and that old metadata markers are gone from description.

select
  id,
  title,
  description,
  scheduled_date,
  deadline_date,
  checklist_items,
  status,
  created_at
from public.jobs
order by created_at desc
limit 25;

select
  count(*) as rows_with_old_meta_marker
from public.jobs
where description like '%<!--notaro_meta:%-->';

select
  count(*) as rows_with_non_array_checklist
from public.jobs
where checklist_items is not null
  and jsonb_typeof(checklist_items) <> 'array';
