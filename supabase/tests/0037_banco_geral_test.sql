-- Teste da 0037 num Postgres local (NÃO rode no Supabase), depois das migrações e dos testes 0028..0035 (antes do 0036, que apaga a pessoa 1111...).
-- 1111... é a administradora; 2222... e 4444... são contas comuns.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant all on storage.objects to authenticated;
grant execute on all functions in schema public to authenticated;
insert into auth.users values ('44444444-4444-4444-4444-444444444444', 'c@x') on conflict do nothing;
insert into admins (uid) values ('11111111-1111-1111-1111-111111111111') on conflict do nothing;

-- conta comum NÃO publica, não escreve direto no banco geral nem na pasta geral/ e não lê a lista de administradores
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ begin
  assert not eh_admin();
  begin perform publicar_no_banco_geral('[]', null); assert false; exception when raise_exception then null; end;
  begin insert into banco_geral (hash, blocos, alternativas) values ('x', '[]', '[]'); assert false; exception when insufficient_privilege then null; end;
  begin insert into storage.objects (bucket_id, name) values ('provas', 'geral/x.png'); assert false; exception when insufficient_privilege then null; end;
  assert (select count(*) from admins) = 0, 'admins não aparece pela API';
end $$;
-- a pessoa 2222 já tinha importado uma das questões (mesmo texto) e tem a disciplina "ANESTESIOLOGIA" e o assunto "Via aérea"
insert into disciplines (id, user_id, nome) values ('d2000000-0000-0000-0000-000000000001', auth.uid(), 'ANESTESIOLOGIA');
insert into topics (id, user_id, discipline_id, nome) values ('e2000000-0000-0000-0000-000000000001', auth.uid(), 'd2000000-0000-0000-0000-000000000001', 'Via aerea');
reset role; insert into admins (uid) values ('22222222-2222-2222-2222-222222222222') on conflict do nothing; set role authenticated; -- importação antiga (antes da 0049, qualquer conta importava)
select importar_banco('[{"hash":"g2","blocos":[{"tipo":"texto","texto":"G2 versão dela"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A","comentario":"anotação dela"}]');
reset role;
delete from admins where uid = '22222222-2222-2222-2222-222222222222';

-- administradora publica 3 questões do próprio banco (com comentário, que NÃO pode ir)
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
insert into disciplines (id, user_id, nome) values ('d1000000-0000-0000-0000-000000000001', auth.uid(), 'Anestesiologia') on conflict do nothing;
select importar_banco('[
  {"hash":"g1","blocos":[{"tipo":"texto","texto":"G1"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"B","gabarito_origem":"oficial","comentario":"comentário do cursinho","discipline_id":"d1000000-0000-0000-0000-000000000001","assunto":"Via aérea","banca":"UFMA","ano":"2020","area":"cirurgia"},
  {"hash":"g2","blocos":[{"tipo":"texto","texto":"G2"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"B","comentario":"outro comentário","discipline_id":"d1000000-0000-0000-0000-000000000001"},
  {"hash":"g3","blocos":[{"tipo":"texto","texto":"G3"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A"}]');
do $$ declare r jsonb; ids jsonb; begin
  assert eh_admin();
  select jsonb_agg(jsonb_build_object('id', id)) into ids from banco_questoes where hash in ('g1','g2','g3');
  r := publicar_no_banco_geral(ids, 'Anestesiologia – lote 1');
  assert r = '{"novas": 3, "atualizadas": 0}'::jsonb, r::text;
  assert (select count(*) from banco_geral) = 3;
  assert not exists (select 1 from information_schema.columns where table_name = 'banco_geral' and column_name ilike '%coment%'), 'sem coluna de comentário';
  assert (select disciplina = 'Anestesiologia' and assunto = 'Via aérea' and banca = 'UFMA' and area = 'cirurgia' and colecao = 'Anestesiologia – lote 1' from banco_geral where hash = 'g1');
  assert (select count(*) from banco_questoes where origem_geral is not null) = 3, 'as dela ficam ligadas';
  assert (select comentario from banco_questoes where hash = 'g1') = 'comentário do cursinho', 'o comentário continua no banco DELA';
  r := publicar_no_banco_geral(ids, null);
  assert r = '{"novas": 0, "atualizadas": 3}'::jsonb, 'publicar de novo atualiza, não duplica: ' || r::text;
  assert (select colecao from banco_geral where hash = 'g1') = 'Anestesiologia – lote 1', 'sem coleção nova, mantém a antiga';
  r := sincronizar_banco_geral();
  assert (select count(*) from banco_questoes where hash like 'g%') = 3, 'a administradora não recebe cópias das próprias';
end $$;
reset role;

-- conta comum: recebe as 3 (a que já tinha vira cópia, sem duplicar), sem comentário, com disciplina/assunto ligados pelo nome
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ declare r jsonb; begin
  r := sincronizar_banco_geral();
  assert (r->>'novas')::int = 2, r::text;
  assert (r->>'corrigidas')::int = 1, 'a G2 dela recebe o texto e o gabarito da geral: ' || r::text;
  assert (select count(*) from banco_questoes where origem_geral is not null) = 3;
  assert (select count(*) from banco_questoes where comentario is not null) = 1 and (select comentario from banco_questoes where hash = 'g2') = 'anotação dela', 'só a anotação dela; nada do cursinho';
  assert (select gabarito = 'B' and blocos->0->>'texto' = 'G2' from banco_questoes where hash = 'g2'), 'correção chegou';
  assert (select discipline_id = 'd2000000-0000-0000-0000-000000000001' and topic_id = 'e2000000-0000-0000-0000-000000000001' and fonte = 'Banco geral · Anestesiologia – lote 1'
            from banco_questoes where hash = 'g1'), 'ligada pelo nome, sem acento/maiúscula';
  assert (select discipline_id is null from banco_questoes where hash = 'g3');
  assert sincronizar_banco_geral() = '{"novas": 0, "corrigidas": 0}'::jsonb, 'nada novo: não faz nada';
  update banco_questoes set topic_id = null, assunto = 'Meu assunto', vezes = 5 where hash = 'g1';
  delete from banco_questoes where hash = 'g3';
  assert (select count(*) from banco_geral_removidas) = 1, 'lembra que ela excluiu';
end $$;
reset role;

-- administradora corrige o gabarito da G1 (e anula a G3) e publica de novo
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
update banco_questoes set gabarito = 'A' where hash = 'g1';
update banco_questoes set anulada = true where hash = 'g3';
select publicar_no_banco_geral((select jsonb_agg(jsonb_build_object('id', id)) from banco_questoes where hash in ('g1','g3')), null);
reset role;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ declare r jsonb; begin
  r := sincronizar_banco_geral();
  assert r = '{"novas": 0, "corrigidas": 1}'::jsonb, 'a G3 excluída não volta; a G1 é corrigida: ' || r::text;
  assert (select gabarito = 'A' and assunto = 'Meu assunto' and vezes = 5 from banco_questoes where hash = 'g1'), 'gabarito novo; assunto e histórico dela ficam';
  assert not exists (select 1 from banco_questoes where hash = 'g3');
  -- trazer de volta as excluídas
  delete from banco_geral_removidas; update profiles set banco_geral_em = null;
  r := sincronizar_banco_geral();
  assert (r->>'novas')::int = 1 and (select anulada from banco_questoes where hash = 'g3'), r::text;
end $$;
reset role;

-- conta nova (4444): recebe tudo de uma vez
select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
set role authenticated;
do $$ begin
  assert (sincronizar_banco_geral()->>'novas')::int = 3;
  -- "Apagar tudo" não conta como excluir: depois de apagar, as questões gerais voltam
  perform apagar_tudo();
  assert (select count(*) from banco_questoes) = 0 and (select count(*) from banco_geral_removidas) = 0;
  assert (sincronizar_banco_geral()->>'novas')::int = 3;
end $$;
reset role;

-- conta comum não consegue tirar (a função apaga em outras contas, então confere a administradora)
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ begin
  begin perform retirar_do_banco_geral(array(select id from banco_questoes where hash = 'g1')); assert false; exception when raise_exception then null; end;
  assert (select count(*) from banco_geral) = 3;
end $$;
reset role;

-- (0038) administradora tira a G3 do banco geral: sai também do banco das outras contas; o dela fica
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
do $$ declare r jsonb; begin
  r := retirar_do_banco_geral(array(select id from banco_questoes where hash = 'g3'));
  assert r = '{"geral": 1, "copias": 2}'::jsonb, r::text;
  assert (select count(*) from banco_geral) = 2;
end $$;
reset role;
do $$ begin
  assert (select count(*) from banco_questoes where hash = 'g3') = 1, 'só a da administradora fica';
  assert (select user_id from banco_questoes where hash = 'g3') = '11111111-1111-1111-1111-111111111111';
  assert (select count(*) from banco_geral_removidas where geral_id is not null) = (select count(*) from banco_geral_removidas), 'nada solto';
  assert (select count(*) from admins) = 1, 'o Apagar tudo da conta 4444 não mexeu nos administradores';
end $$;

-- (0038) cópia antiga, de uma questão tirada antes da 0038 (sem ligação, fonte "Banco geral"): tirar de novo limpa.
-- A G2 da 2222 ela mesma tinha importado (não veio do banco geral): continua com ela.
update banco_questoes set origem_geral = null where hash = 'g1' and user_id = '22222222-2222-2222-2222-222222222222';
insert into banco_questoes (user_id, hash, blocos, alternativas, fonte)
  values ('44444444-4444-4444-4444-444444444444', 'propria', '[]', '[]', 'minha'); -- questão própria de outra conta: não pode sumir
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
do $$ declare r jsonb; begin
  r := retirar_do_banco_geral(array(select id from banco_questoes where hash in ('g1', 'g2')));
  assert r = '{"geral": 2, "copias": 3}'::jsonb, 'G1: a antiga sem ligação (2222) e a ligada (4444); G2: só a da 4444. ' || r::text;
end $$;
reset role;
do $$ begin
  assert (select count(*) from banco_questoes where hash = 'g1' and user_id <> '11111111-1111-1111-1111-111111111111') = 0;
  assert (select count(*) from banco_questoes where hash = 'g2' and user_id = '22222222-2222-2222-2222-222222222222') = 1, 'a que ela importou fica';
  assert (select count(*) from banco_questoes where hash = 'propria') = 1;
  assert (select count(*) from banco_geral) = 0;
end $$;
select 'OK 0037 + 0038';
