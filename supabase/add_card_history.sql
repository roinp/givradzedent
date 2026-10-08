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
