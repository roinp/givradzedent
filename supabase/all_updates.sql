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

notify pgrst, 'reload schema';
