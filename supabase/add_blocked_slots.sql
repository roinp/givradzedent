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

notify pgrst, 'reload schema';
