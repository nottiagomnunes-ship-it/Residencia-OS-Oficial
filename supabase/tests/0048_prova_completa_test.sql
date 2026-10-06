-- Teste da 0048 num Postgres local (NÃO rode no Supabase), depois da 0046/0047 (1111 = administradora; 2222 = estudante).
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
-- uma "prova" TESTE 2025: as questões chegam fora de ordem (3, 1, 2); a 4 está sem gabarito (fica de fora); a 2 foi anulada
select importar_banco('[
  {"hash":"pc3","blocos":[{"tipo":"texto","texto":"Questão três"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"B","banca":"TESTE","ano":2025,"numero":3},
  {"hash":"pc1","blocos":[{"tipo":"texto","texto":"Questão um"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A","banca":"TESTE","ano":2025,"numero":1},
  {"hash":"pc2","blocos":[{"tipo":"texto","texto":"Questão dois"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"anulada":true,"banca":"TESTE","ano":2025,"numero":"2"},
  {"hash":"pc4","blocos":[{"tipo":"texto","texto":"Questão quatro"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"banca":"TESTE","ano":2025,"numero":"abc"}]');
do $$ declare t uuid; t2 uuid; p uuid; q1 uuid; q3 uuid; r jsonb; begin
  assert (select numero from banco_questoes where hash = 'pc2') = 2, 'número em texto também vale';
  assert (select numero from banco_questoes where hash = 'pc4') is null, 'número inválido fica vazio';
  -- (desde a 0050, a prova é cadastrada no banco geral e montada pelo cadastro)
  perform publicar_no_banco_geral((select jsonb_agg(jsonb_build_object('id', id)) from banco_questoes where hash in ('pc1', 'pc2', 'pc3', 'pc4')), null);
  perform cadastrar_prova_geral('{"nome":"TESTE 2025","banca":"TESTE","ano":2025,"total":4}', (select jsonb_agg(jsonb_build_object('id', id, 'numero', numero)) from banco_questoes where hash like 'pc_'));
  t := montar_prova_do_banco((select id from provas_geral where nome = 'TESTE 2025'));
  select prova_id into p from prova_tentativas where id = t;
  assert (select do_banco and tipo = 'prova' and nome = 'TESTE 2025' and banca = 'TESTE' and ano = 2025 from provas where id = p), 'é uma prova (Simulados), do banco';
  assert (select string_agg(blocos->0->>'texto', ',' order by numero) from prova_questoes where prova_id = p) = 'Questão um,Questão dois,Questão três', 'na ordem da prova, sem a que não tem gabarito';
  t2 := montar_prova_do_banco((select id from provas_geral where nome = 'TESTE 2025'));
  assert t2 = t, 'com tentativa em andamento, continua nela';
  begin perform montar_prova_do_banco(gen_random_uuid()); assert false; exception when raise_exception then null; end;
  -- faz a prova: acerta a 1, erra a 3
  select id into q1 from prova_questoes where prova_id = p and numero = 1;
  select id into q3 from prova_questoes where prova_id = p and numero = 3;
  insert into prova_respostas (user_id, tentativa_id, questao_id, alternativa) values (auth.uid(), t, q1, 'A'), (auth.uid(), t, q3, 'A');
  perform entregar_tentativa(t, 600);
  r := corrigir_tentativa(t, '2026-10-06', 10, 2, 1, '{}'::jsonb);
  assert (r->>'mock_exam_id') is not null, 'resultado em Simulados';
  assert (select vezes = 1 and acertos = 1 from banco_questoes where hash = 'pc1'), 'conta na questão do banco';
  assert (select vezes = 1 and acertos = 0 and ultimo_certo = false from banco_questoes where hash = 'pc3');
  assert (select banco_questao_id from error_notebook e join prova_respostas x on x.erro_id = e.id where x.questao_id = q3) = (select id from banco_questoes where hash = 'pc3'), 'Caderno ligado à questão';
  assert exists (select 1 from revisao_questoes where questao_id = (select id from banco_questoes where hash = 'pc3')), 'errada vai para refazer';
  t2 := montar_prova_do_banco((select id from provas_geral where nome = 'TESTE 2025'));
  assert t2 <> t, 'depois de corrigida, uma nova tentativa';
  assert (select prova_id from prova_tentativas where id = t2) = p, 'mesmas questões: refaz na mesma prova';
  delete from prova_tentativas where id = t2;
  update banco_questoes set gabarito = 'A', numero = 4 where hash = 'pc4'; -- entrou mais uma questão com gabarito
  perform cadastrar_prova_geral('{"nome":"TESTE 2025","banca":"TESTE","ano":2025,"total":4}', (select jsonb_agg(jsonb_build_object('id', id, 'numero', 4)) from banco_questoes where hash = 'pc4'));
  t2 := montar_prova_do_banco((select id from provas_geral where nome = 'TESTE 2025'));
  assert (select prova_id from prova_tentativas where id = t2) <> p, 'questões mudaram: prova nova';
  assert (select count(*) from prova_questoes q join prova_tentativas x on x.prova_id = q.prova_id where x.id = t2) = 4;
  -- mudar só o número marca como alterada
  update banco_questoes set sincronizada_em = now() - interval '1 minute', alterada_em = null where hash = 'pc1';
  update banco_questoes set numero = 7 where hash = 'pc1';
  assert (select alterada_em is not null from banco_questoes where hash = 'pc1'), 'número conta como alteração';
  update banco_questoes set numero = 1 where hash = 'pc1';
  -- publicar leva o número
  perform publicar_no_banco_geral((select jsonb_agg(jsonb_build_object('id', id)) from banco_questoes where hash in ('pc1', 'pc3')), null);
  assert (select numero from banco_geral where hash = 'pc3') = 3, 'banco geral recebe o número';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ begin
  perform sincronizar_banco_geral();
  assert (select numero from banco_questoes where hash = 'pc3' and user_id = auth.uid()) = 3, 'a conta recebe o número';
end $$;
reset role;
-- correção do número na geral chega a quem já tinha a questão
update banco_geral set numero = 30, atualizada_em = now() where hash = 'pc3';
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ begin
  perform sincronizar_banco_geral();
  assert (select numero from banco_questoes where hash = 'pc3' and user_id = auth.uid()) = 30, 'correção do número chega';
end $$;
reset role;
select 'OK 0048';
