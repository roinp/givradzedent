-- პაციენტის პირადი ნომერი. გაუშვით ერთხელ Supabase → SQL Editor-ში.
alter table public.patients
  add column if not exists personal_id text;

-- ერთი პირადი ნომერი მხოლოდ ერთ პაციენტს შეიძლება ჰქონდეს.
create unique index if not exists patients_personal_id_key
  on public.patients (personal_id) where personal_id is not null;

notify pgrst, 'reload schema';
