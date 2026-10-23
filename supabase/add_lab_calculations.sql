-- ლაბორატორიის ხარჯთაღრიცხვები (იგივე ფორმა, რაც კალკულაციას, ცალკე ისტორიით).
-- გაუშვით ერთხელ Supabase → SQL Editor-ში.
create table if not exists public.lab_calculations (
  id uuid primary key default gen_random_uuid(),
  patient_name text,
  discount numeric(5, 2) not null default 0,
  rows jsonb not null default '[]'::jsonb,
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists lab_calculations_updated_idx on public.lab_calculations (updated_at desc);

alter table public.lab_calculations enable row level security;

drop policy if exists "staff all lab_calculations" on public.lab_calculations;
create policy "staff all lab_calculations" on public.lab_calculations
  for all to authenticated using (true) with check (true);


-- ლაბორატორიის სახელი (იბეჭდება სათაურად)
alter table public.lab_calculations add column if not exists lab_name text;

notify pgrst, 'reload schema';
