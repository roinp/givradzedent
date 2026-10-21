-- პაციენტის გადახდების ისტორია (თარიღი, თანხა, გადახდის ფორმა).
-- treatments.paid ახლა ავტომატურად ითვლება ამ ცხრილიდან.
-- გაუშვით ერთხელ Supabase → SQL Editor-ში.
create table if not exists public.patient_payments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  treatment_id uuid references public.treatments (id) on delete set null,
  date date not null default current_date,
  amount numeric(10, 2) not null default 0,
  method text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists patient_payments_patient_idx on public.patient_payments (patient_id, date desc);
create index if not exists patient_payments_treatment_idx on public.patient_payments (treatment_id);

alter table public.patient_payments enable row level security;

drop policy if exists "staff all patient_payments" on public.patient_payments;
create policy "staff all patient_payments" on public.patient_payments
  for all to authenticated using (true) with check (true);

-- treatments.paid = ამ მკურნალობაზე მიბმული გადახდების ჯამი.
create or replace function public.sync_treatment_paid()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and old.treatment_id is not null then
    update public.treatments t
    set paid = coalesce((select sum(amount) from public.patient_payments where treatment_id = t.id), 0)
    where t.id = old.treatment_id;
  end if;
  if tg_op in ('INSERT', 'UPDATE') and new.treatment_id is not null then
    update public.treatments t
    set paid = coalesce((select sum(amount) from public.patient_payments where treatment_id = t.id), 0)
    where t.id = new.treatment_id;
  end if;
  return null;
end;
$$;

drop trigger if exists patient_payments_sync_paid on public.patient_payments;
create trigger patient_payments_sync_paid
  after insert or update or delete on public.patient_payments
  for each row execute function public.sync_treatment_paid();

-- ძველი „გადახდილი“ თანხები გადაგვაქვს ისტორიაში (მკურნალობის თარიღით).
insert into public.patient_payments (patient_id, treatment_id, date, amount, notes)
select t.patient_id, t.id, t.date, t.paid, 'გადატანილი ძველი ჩანაწერიდან'
from public.treatments t
where t.paid > 0
  and not exists (select 1 from public.patient_payments p where p.treatment_id = t.id);

notify pgrst, 'reload schema';
