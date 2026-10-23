-- ლაბორატორიის სახელი, სადაც იგზავნება სამუშაო (იბეჭდება სათაურად).
-- გაუშვით ერთხელ Supabase → SQL Editor-ში.
alter table public.lab_calculations add column if not exists lab_name text;

notify pgrst, 'reload schema';
