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


notify pgrst, 'reload schema';
