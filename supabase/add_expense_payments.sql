-- კომპანიებთან გადახდების ისტორია (ხარჯები ჯგუფდება კომპანიის მიხედვით).
-- გაუშვით ერთხელ Supabase → SQL Editor-ში.
create table if not exists public.expense_payments (
  id uuid primary key default gen_random_uuid(),
  supplier text,
  date date not null default current_date,
  amount numeric(10, 2) not null default 0,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists expense_payments_supplier_idx on public.expense_payments (lower(trim(supplier)));

alter table public.expense_payments enable row level security;

drop policy if exists "staff all expense_payments" on public.expense_payments;
create policy "staff all expense_payments" on public.expense_payments
  for all to authenticated using (true) with check (true);

-- ძველი ხარჯების „გადარიცხული“ თანხები გადაგვაქვს ისტორიაში (ხარჯის თარიღით).
insert into public.expense_payments (supplier, date, amount, notes)
select nullif(trim(supplier), ''), date, paid, 'გადატანილი: ' || item
from public.expenses
where paid > 0;

update public.expenses set paid = 0 where paid > 0;

notify pgrst, 'reload schema';
