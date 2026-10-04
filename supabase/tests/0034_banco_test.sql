-- Teste da 0034 num Postgres local (NÃO rode no Supabase), depois das migrações e de 0028_provas_test.sql.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
insert into admins (uid) values ('11111111-1111-1111-1111-111111111111') on conflict do nothing; -- desde a 0049, só a administração importa
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
insert into disciplines (id, user_id, nome) values ('d0000000-0000-0000-0000-0000000000aa', auth.uid(), 'Anestesiologia') on conflict do nothing;
do $$ declare n int; v_t uuid; qq record; r jsonb; xp0 int; ids uuid[];
begin
  xp0 := (select xp from profiles);
  n := importar_banco('[{"hash":"h1","blocos":[{"tipo":"texto","texto":"Q1"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A","gabarito_origem":"oficial","discipline_id":"d0000000-0000-0000-0000-0000000000aa","assunto":"Via aérea","banca":"UFMA","ano":"2018"},
                         {"hash":"h2","blocos":[{"tipo":"texto","texto":"Q2"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"B","discipline_id":"d0000000-0000-0000-0000-0000000000aa"},
                         {"hash":"h3","blocos":[{"tipo":"texto","texto":"Q3"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A"}]');
  assert n = 3;
  n := importar_banco('[{"hash":"h1","blocos":[],"alternativas":[]},{"hash":"h4","blocos":[{"tipo":"texto","texto":"Q4"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"anulada":true}]');
  assert n = 1, 'repetida não entra';
  select array_agg(id order by hash) into ids from banco_questoes where hash in ('h1','h2','h3','h4');
  v_t := montar_lista('Lista teste', ids);
  assert (select tipo from provas p join prova_tentativas t on t.prova_id = p.id where t.id = v_t) = 'lista';
  assert (select count(*) from prova_questoes q join prova_tentativas t on t.prova_id = q.prova_id where t.id = v_t) = 4;
  for qq in select q.id, q.numero from prova_questoes q join prova_tentativas t on t.prova_id = q.prova_id where t.id = v_t order by numero loop
    if qq.numero = 1 then perform responder_questao(v_t, qq.id, 'A', false, false, '', 60, 1); end if;  -- certa
    if qq.numero = 2 then perform responder_questao(v_t, qq.id, 'A', false, false, '', 120, 2); end if; -- errada
    if qq.numero = 3 then perform responder_questao(v_t, qq.id, 'A', true, false, '', 130, 3); end if;  -- certa no chute
  end loop;
  perform entregar_tentativa(v_t, 130);
  begin perform corrigir_lista(v_t, '2026-10-04', 1, 3, 1, '{}'); assert false; exception when raise_exception then null; end;
  r := corrigir_lista(v_t, '2026-10-04', 1, 3, 2, '{}');
  assert (r->>'caderno')::int = 2, r::text;
  assert (select count(*) from question_sets where banca = 'Banco de questões') = 2, 'uma por disciplina/assunto';
  assert (select sum(total) from question_sets where banca = 'Banco de questões') = 3;
  assert (select count(*) from mock_exams where nome = 'Lista teste') = 0, 'lista não vai para simulados';
  assert (select vezes || '/' || acertos || '/' || ultimo_certo from banco_questoes where hash = 'h2') = '1/0/false';
  assert (select vezes from banco_questoes where hash = 'h4') = 0, 'anulada não conta';
  assert (select xp from profiles) = xp0 + 1;
  assert (select count(*) from error_notebook e where e.discipline_id = 'd0000000-0000-0000-0000-0000000000aa') = 1, 'erro já vem com a disciplina';
  -- uma prova normal não pode ser corrigida como lista
  begin perform corrigir_lista((select id from prova_tentativas where prova_id = 'a0000000-0000-0000-0000-000000000001' limit 1), '2026-10-04', 1, 1, 1, '{}'); assert false;
  exception when raise_exception then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ begin
  assert (select count(*) from banco_questoes) = 0, 'RLS';
  begin perform montar_lista('x', array[(select '00000000-0000-0000-0000-000000000000'::uuid)]); assert false; exception when raise_exception then null; end;
end $$;
reset role;
select 'OK 0034';
