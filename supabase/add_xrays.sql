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
