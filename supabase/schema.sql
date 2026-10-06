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
  phone text,
  date_of_birth date,
  notes text,
  created_at timestamptz not null default now()
);

create index if not exists patients_name_idx on public.patients (last_name, first_name);

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
