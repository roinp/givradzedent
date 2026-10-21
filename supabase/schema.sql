-- გივრაძე დენტ — Supabase-ის სქემა
-- გაუშვით Supabase Dashboard → SQL Editor-ში.

-- ===== users (თანამშრომლები; აკავშირებს Supabase Auth-ს) =====
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  full_name text,
  role text not null default 'staff' check (role in ('admin', 'staff')),
  created_at timestamptz not null default now()
);

-- ახალი Auth მომხმარებლის შექმნისას ავტომატურად ემატება public.users-ში
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data ->> 'full_name')
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ===== doctors =====
create table if not exists public.doctors (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  specialty text,
  created_at timestamptz not null default now()
);

-- ===== patients =====
create table if not exists public.patients (
  id uuid primary key default gen_random_uuid(),
  first_name text not null,
  last_name text not null,
  personal_id text,
  phone text,
  date_of_birth date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists patients_name_idx on public.patients (last_name, first_name);
create unique index if not exists patients_personal_id_key
  on public.patients (personal_id) where personal_id is not null;

-- ===== appointments =====
create table if not exists public.appointments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  doctor_id uuid references public.doctors (id) on delete set null,
  date date not null,
  time time not null,
  reason text,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists appointments_date_idx on public.appointments (date, time);
create index if not exists appointments_patient_idx on public.appointments (patient_id);

-- ===== treatments =====
create table if not exists public.treatments (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  doctor_id uuid references public.doctors (id) on delete set null,
  date date not null default current_date,
  procedure text not null,
  tooth_number text,
  notes text,
  price numeric(10, 2) not null default 0,
  paid numeric(10, 2) not null default 0,
  xray_path text,
  xray_paths text[] not null default '{}',
  created_at timestamptz not null default now()
);

create index if not exists treatments_patient_idx on public.treatments (patient_id, date desc);

-- ===== Row Level Security: მხოლოდ შესული (authenticated) თანამშრომლები =====
alter table public.users enable row level security;
alter table public.doctors enable row level security;
alter table public.patients enable row level security;
alter table public.appointments enable row level security;
alter table public.treatments enable row level security;

drop policy if exists "staff read users" on public.users;
create policy "staff read users" on public.users
  for select to authenticated using (true);

drop policy if exists "staff all doctors" on public.doctors;
create policy "staff all doctors" on public.doctors
  for all to authenticated using (true) with check (true);

drop policy if exists "staff all patients" on public.patients;
create policy "staff all patients" on public.patients
  for all to authenticated using (true) with check (true);

drop policy if exists "staff all appointments" on public.appointments;
create policy "staff all appointments" on public.appointments
  for all to authenticated using (true) with check (true);

drop policy if exists "staff all treatments" on public.treatments;
create policy "staff all treatments" on public.treatments
  for all to authenticated using (true) with check (true);

-- ===== expenses (კლინიკის ხარჯები) =====
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

-- ===== medical_cards (სამედიცინო ბარათი, ფორმა IV-220) =====
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

-- ===== storage: რენტგენის სურათები =====
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

-- ===== medical_card_versions (ბარათის ისტორია) =====
create table if not exists public.medical_card_versions (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.patients (id) on delete cascade,
  card_number bigint,
  version_date date not null,
  data jsonb not null,
  saved_at timestamptz not null default now()
);

create index if not exists medical_card_versions_patient_idx
  on public.medical_card_versions (patient_id, version_date desc);

alter table public.medical_card_versions enable row level security;

drop policy if exists "staff all medical_card_versions" on public.medical_card_versions;
create policy "staff all medical_card_versions" on public.medical_card_versions
  for all to authenticated using (true) with check (true);


-- ===== calculations (შენახული კალკულაციები) =====
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

-- ===== blocked_slots (დაბლოკილი საათები) =====
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
as $$
begin
  if exists (select 1 from public.blocked_slots b where b.date = new.date and b.time = new.time) then
    raise exception '% % დაბლოკილია, აირჩიეთ სხვა დრო', new.date, to_char(new.time, 'HH24:MI');
  end if;
  return new;
end;
$$;

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

