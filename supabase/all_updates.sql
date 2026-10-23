-- ყველა განახლება ერთად. უსაფრთხოა რამდენჯერაც გინდა გაეშვას —
-- რაც უკვე არსებობს, გამოტოვდება. Supabase → SQL Editor → Run.

-- ===== add_paid_column =====
alter table public.treatments
  add column if not exists paid numeric(10, 2) not null default 0;


-- ===== add_expenses =====
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


-- ===== add_personal_id =====
-- პაციენტის პირადი ნომერი. გაუშვით ერთხელ Supabase → SQL Editor-ში.
alter table public.patients
  add column if not exists personal_id text;

-- ერთი პირადი ნომერი მხოლოდ ერთ პაციენტს შეიძლება ჰქონდეს.
create unique index if not exists patients_personal_id_key
  on public.patients (personal_id) where personal_id is not null;


-- ===== add_medical_cards =====
-- სამედიცინო ბარათები (ფორმა IV-220). ერთი ბარათი თითო პაციენტზე.
-- გაუშვით ერთხელ Supabase → SQL Editor-ში.
create table if not exists public.medical_cards (
  id uuid primary key default gen_random_uuid(),
  card_number bigint generated always as identity unique,
  patient_id uuid not null unique references public.patients (id) on delete cascade,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.medical_cards enable row level security;

drop policy if exists "staff all medical_cards" on public.medical_cards;
create policy "staff all medical_cards" on public.medical_cards
  for all to authenticated using (true) with check (true);


-- ===== add_xrays =====
-- რენტგენის სურათები მკურნალობის ჩანაწერებზე.
-- გაუშვით ერთხელ Supabase → SQL Editor-ში.
alter table public.treatments
  add column if not exists xray_path text;

-- დახურული (private) საცავი: სურათებს მხოლოდ შესული თანამშრომლები ხედავენ.
insert into storage.buckets (id, name, public)
values ('xrays', 'xrays', false)
on conflict (id) do nothing;

drop policy if exists "staff read xrays" on storage.objects;
create policy "staff read xrays" on storage.objects
  for select to authenticated using (bucket_id = 'xrays');

drop policy if exists "staff upload xrays" on storage.objects;
create policy "staff upload xrays" on storage.objects
  for insert to authenticated with check (bucket_id = 'xrays');

drop policy if exists "staff update xrays" on storage.objects;
create policy "staff update xrays" on storage.objects
  for update to authenticated using (bucket_id = 'xrays');

drop policy if exists "staff delete xrays" on storage.objects;
create policy "staff delete xrays" on storage.objects
  for delete to authenticated using (bucket_id = 'xrays');


-- ===== add_xray_gallery =====
-- Multiple X-ray images per treatment (replaces the single xray_path).
alter table public.treatments
  add column if not exists xray_paths text[] not null default '{}';

-- Move images uploaded with the old single-image version into the list.
update public.treatments
  set xray_paths = array[xray_path]
  where xray_path is not null and cardinality(xray_paths) = 0;


-- ===== add_card_history =====
-- Medical card history: dated copies of each patient's card (one per examination per day).
create table if not exists public.medical_card_versions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  card_number bigint,
  version_date date not null,
  data jsonb not null,
  saved_at timestamptz not null default now()
);

-- Several examinations can happen on the same day, so the date is not unique.
alter table public.medical_card_versions
  drop constraint if exists medical_card_versions_patient_id_version_date_key;

create index if not exists medical_card_versions_patient_idx
  on public.medical_card_versions (patient_id, version_date desc);

alter table public.medical_card_versions enable row level security;

drop policy if exists "staff all medical_card_versions" on public.medical_card_versions;
create policy "staff all medical_card_versions" on public.medical_card_versions
  for all to authenticated using (true) with check (true);

-- Put cards that are not in the history yet into it.
insert into public.medical_card_versions (patient_id, card_number, version_date, data, saved_at)
select c.patient_id, c.card_number, c.updated_at::date, c.data, c.updated_at
from public.medical_cards c
where not exists (select 1 from public.medical_card_versions v where v.patient_id = c.patient_id);

-- ===== add_calculations =====
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


-- ===== add_blocked_slots =====
-- დაბლოკილი საათები: ამ დროზე პაციენტის ჩაწერა შეუძლებელია.
-- გაუშვით ერთხელ Supabase → SQL Editor-ში.
create table if not exists public.blocked_slots (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  time time not null,
  created_at timestamptz not null default now(),
  unique (date, time)
);

alter table public.blocked_slots enable row level security;

drop policy if exists "staff all blocked_slots" on public.blocked_slots;
create policy "staff all blocked_slots" on public.blocked_slots
  for all to authenticated using (true) with check (true);

-- ბაზის დონეზეც ვკრძალავთ ვიზიტის ჩაწერას დაბლოკილ საათზე.
create or replace function public.reject_blocked_appointment()
returns trigger
language plpgsql
as $
begin
  if exists (select 1 from public.blocked_slots b where b.date = new.date and b.time = new.time) then
    raise exception '% % დაბლოკილია, აირჩიეთ სხვა დრო', new.date, to_char(new.time, 'HH24:MI');
  end if;
  return new;
end;
$;

drop trigger if exists appointments_blocked_insert on public.appointments;
create trigger appointments_blocked_insert
  before insert on public.appointments
  for each row execute function public.reject_blocked_appointment();

drop trigger if exists appointments_blocked_update on public.appointments;
create trigger appointments_blocked_update
  before update on public.appointments
  for each row
  when (new.date is distinct from old.date or new.time is distinct from old.time)
  execute function public.reject_blocked_appointment();


-- ===== SMS =====
alter table public.appointments add column if not exists sms_confirm_sent_at timestamptz;
alter table public.appointments add column if not exists sms_reminder_sent_at timestamptz;


-- ===== expense_payments (კომპანიებთან გადახდების ისტორია) =====
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


-- ===== patient_payments (პაციენტის გადახდების ისტორია) =====
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


-- ===== lab_calculations (ლაბორატორიის ხარჯთაღრიცხვები) =====
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
