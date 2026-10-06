alter table public.treatments
  add column if not exists paid numeric(10, 2) not null default 0;

notify pgrst, 'reload schema';
