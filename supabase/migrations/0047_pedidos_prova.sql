-- Pedido de prova: quem usa pede que uma prova entre no banco geral (banca, ano e, se tiver, o PDF). Vai junto com as mensagens
-- (Administração → Mensagens), a administradora prepara a prova, publica e responde. Pode ser executada mais de uma vez (depois da 0044 e da 0046).

alter table mensagens drop constraint if exists mensagens_tipo_check;
alter table mensagens add constraint mensagens_tipo_check check (tipo in ('sugestao', 'problema', 'outro', 'prova'));
alter table mensagens add column if not exists banca text check (length(banca) <= 80);
alter table mensagens add column if not exists ano int check (ano between 1990 and 2100);
-- PDF no armazenamento "importacao", na pasta de quem pediu (<id>/pedidos/<arquivo>.pdf); apagado quando o pedido é resolvido
alter table mensagens add column if not exists anexo text check (length(anexo) <= 300);

drop policy if exists "mensagens: quem enviou envia" on mensagens;
create policy "mensagens: quem enviou envia" on mensagens for insert to authenticated
  with check (user_id = auth.uid() and resposta is null and respondida_em is null and resolvida_em is null
    and (anexo is null or split_part(anexo, '/', 1) = auth.uid()::text)
    and (tipo = 'prova' or (banca is null and ano is null and anexo is null)));

-- a administradora baixa (e apaga, ao resolver) o PDF de um pedido
drop policy if exists "importacao: admin ve" on storage.objects;
drop policy if exists "importacao: admin apaga" on storage.objects;
create policy "importacao: admin ve" on storage.objects for select to authenticated using (bucket_id = 'importacao' and eh_admin());
create policy "importacao: admin apaga" on storage.objects for delete to authenticated using (bucket_id = 'importacao' and eh_admin());
