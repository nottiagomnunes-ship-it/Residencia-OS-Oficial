-- Teste da 0050 num Postgres local (NÃO rode no Supabase), depois da 0049 (1111 = administradora; 2222 = estudante).
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
-- duas provas da mesma banca e ano (acesso direto e R+), com números que se repetem; e uma questão avulsa
select importar_banco('[
  {"hash":"pa1","blocos":[{"tipo":"texto","texto":"AD 1"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A","banca":"PROVA-X","ano":2025,"numero":1},
  {"hash":"pa2","blocos":[{"tipo":"texto","texto":"AD 2"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"B","banca":"PROVA-X","ano":2025,"numero":2},
  {"hash":"pa3","blocos":[{"tipo":"texto","texto":"AD 3 sem gabarito"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"banca":"PROVA-X","ano":2025,"numero":3},
  {"hash":"pr1","blocos":[{"tipo":"texto","texto":"R+ 1"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A","banca":"PROVA-X","ano":2025,"numero":1},
  {"hash":"pv1","blocos":[{"tipo":"texto","texto":"Avulsa"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A","banca":"PROVA-X","ano":2025}]');
do $$ declare r jsonb; ad uuid; rp uuid; begin
  perform publicar_no_banco_geral((select jsonb_agg(jsonb_build_object('id', id)) from banco_questoes where hash like 'p%' and hash in ('pa1','pa2','pa3','pr1','pv1')), null);
  r := cadastrar_prova_geral('{"nome":"PROVA-X 2025 – Acesso direto","banca":"PROVA-X","ano":2025,"total":4}',
         (select jsonb_agg(jsonb_build_object('id', id, 'numero', numero)) from banco_questoes where hash in ('pa1','pa2','pa3')));
  ad := (r->>'id')::uuid;
  assert (r->>'ligadas')::int = 3;
  r := cadastrar_prova_geral('{"nome":"PROVA-X 2025 – R+","banca":"PROVA-X","ano":2025,"total":1}',
         (select jsonb_agg(jsonb_build_object('id', id, 'numero', numero)) from banco_questoes where hash = 'pr1'));
  rp := (r->>'id')::uuid;
  assert ad <> rp and (select count(*) from provas_geral where banca = 'PROVA-X') = 2, 'mesma banca e ano, provas separadas';
  -- cadastrar de novo completa a mesma (não duplica) e muda o total
  r := cadastrar_prova_geral('{"nome":"PROVA-X 2025 – Acesso direto","banca":"PROVA-X","ano":2025,"total":3}', '[]');
  assert (r->>'id')::uuid = ad and (select total from provas_geral where id = ad) = 3;
  assert (select count(*) from prova_geral_questoes where prova_id = ad) = 3;
  -- cadastrar com o que já está no banco geral (banca + ano): pega as que têm número, um por número
  r := cadastrar_prova_existente('PROVA-X 2025 – tudo', 'PROVA-X', 2025, 3, null);
  assert (r->>'ligadas')::int = 3, 'um por número (1, 2, 3), avulsa fica de fora';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ declare ad uuid := (select id from provas_geral where nome like '%Acesso direto'); t uuid; t2 uuid; p uuid; begin
  begin perform cadastrar_prova_geral('{"nome":"minha","banca":"X","ano":2025,"total":1}', '[]'); assert false; exception when insufficient_privilege then null; end;
  begin insert into provas_geral (nome, banca, ano, total) values ('minha', 'X', 2025, 1); assert false; exception when insufficient_privilege then null; end;
  assert (select count(*) from provas_geral) >= 2, 'todos leem as provas';
  perform sincronizar_banco_geral();
  t := montar_prova_do_banco(ad);
  select prova_id into p from prova_tentativas where id = t;
  assert (select nome = 'PROVA-X 2025 – Acesso direto' and prova_geral = ad and do_banco from provas where id = p);
  assert (select string_agg(numero::text || ':' || (blocos->0->>'texto'), ',' order by numero) from prova_questoes where prova_id = p) = '1:AD 1,2:AD 2', 'só a prova certa, com o número dela, sem a sem gabarito';
  assert montar_prova_do_banco(ad) = t, 'em andamento: continua';
  update prova_tentativas set status = 'corrigida' where id = t;
  t2 := montar_prova_do_banco(ad);
  assert (select prova_id from prova_tentativas where id = t2) = p, 'mesmas questões: refaz na mesma prova';
end $$;
reset role;
select 'OK 0050';
