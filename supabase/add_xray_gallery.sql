-- Multiple X-ray images per treatment (replaces the single xray_path).
alter table public.treatments
  add column if not exists xray_paths text[] not null default '{}';

-- Move images uploaded with the old single-image version into the list.
update public.treatments
  set xray_paths = array[xray_path]
  where xray_path is not null and cardinality(xray_paths) = 0;

notify pgrst, 'reload schema';
