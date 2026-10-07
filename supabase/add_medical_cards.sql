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

notify pgrst, 'reload schema';
