insert into storage.buckets (id, name, public)
values ('instrument-assets', 'instrument-assets', true)
on conflict (id) do nothing;

create policy "Instrument assets public read"
  on storage.objects for select
  using (bucket_id = 'instrument-assets');

create policy "Instrument assets public insert"
  on storage.objects for insert
  with check (bucket_id = 'instrument-assets');

create policy "Instrument assets public update"
  on storage.objects for update
  using (bucket_id = 'instrument-assets');

create policy "Instrument assets public delete"
  on storage.objects for delete
  using (bucket_id = 'instrument-assets');