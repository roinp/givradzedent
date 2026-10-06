-- კლინიკის ხარჯები (ინვენტარი, იმპლანტები, მასალები...).
-- გაუშვით ერთხელ Supabase → SQL Editor-ში.
create table if not exists public.expenses (
  id uuid primary key default gen_random_uuid(),
  date date not null default current_date,
  item text not null,
  category text,
  unit_price numeric(10, 2) not null default 0,
  quantity numeric(10, 2) not null default 1,
  supplier text,
  paid numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists expenses_date_idx on public.expenses (date desc);

alter table public.expenses enable row level security;

drop policy if exists "staff all expenses" on public.expenses;
create policy "staff all expenses" on public.expenses
  for all to authenticated using (true) with check (true);

notify pgrst, 'reload schema';
