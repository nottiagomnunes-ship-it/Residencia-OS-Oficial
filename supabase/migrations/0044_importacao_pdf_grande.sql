-- PDF de questões grande (mais de ~4 MB, o limite do envio direto ao servidor): o navegador põe o arquivo aqui, o servidor lê e apaga.
-- Pasta privada por pessoa (<seu id>/<arquivo>.pdf), só PDF, até 30 MB. Pode ser executada mais de uma vez.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('importacao', 'importacao', false, 31457280, array['application/pdf'])
  on conflict (id) do update set file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "importacao: ver os proprios" on storage.objects;
drop policy if exists "importacao: enviar na propria pasta" on storage.objects;
drop policy if exists "importacao: apagar os proprios" on storage.objects;
create policy "importacao: ver os proprios" on storage.objects for select to authenticated
  using (bucket_id = 'importacao' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "importacao: enviar na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'importacao' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "importacao: apagar os proprios" on storage.objects for delete to authenticated
  using (bucket_id = 'importacao' and (storage.foldername(name))[1] = auth.uid()::text);
