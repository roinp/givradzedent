-- Saved price calculations (cost estimates), available from any computer.
create table if not exists public.calculations (
  id uuid primary key default gen_random_uuid(),
  patient_name text,
  discount numeric(5, 2) not null default 0,
  rows jsonb not null default '[]'::jsonb,
  total numeric(10, 2) not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists calculations_updated_idx on public.calculations (updated_at desc);

alter table public.calculations enable row level security;

drop policy if exists "staff all calculations" on public.calculations;
create policy "staff all calculations" on public.calculations
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
