-- Teste da 0028 num Postgres local (NÃO rode no Supabase): stub_supabase.sql + migrações 0001..0028 + este arquivo.
-- Simula a pessoa logada com set_config('request.jwt.claim.sub', ...) e confere o fluxo inteiro e a RLS.
\set ON_ERROR_STOP 1
grant usage on schema public, auth, storage to authenticated;
grant all on all tables in schema public to authenticated;
grant all on storage.objects to authenticated;
grant execute on all functions in schema public, auth, storage to authenticated;

insert into auth.users values ('11111111-1111-1111-1111-111111111111', 'a@x'), ('22222222-2222-2222-2222-222222222222', 'b@x');
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;

insert into disciplines (id, user_id, nome) values ('d0000000-0000-0000-0000-000000000001', auth.uid(), 'Pediatria');
insert into schedule_items (user_id, tipo, titulo, data) values (auth.uid(), 'simulado', 'Simulado', '2026-10-03');

select salvar_prova('{"id":"a0000000-0000-0000-0000-000000000001","nome":"UEPA 2022","banca":"UEPA","ano":2022}',
  '[{"numero":1,"blocos":[{"tipo":"texto","texto":"Q1"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A","area":"preventiva"},
    {"numero":2,"blocos":[{"tipo":"texto","texto":"Q2"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":null,"area":"pediatria"},
    {"numero":3,"blocos":[{"tipo":"texto","texto":"Q3"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"B"},
    {"numero":4,"blocos":[{"tipo":"texto","texto":"Q4"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"B","area":"pediatria"},
    {"numero":5,"blocos":[{"tipo":"texto","texto":"Q5"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"anulada":true}]');

do $$
declare v_t uuid; v_t2 uuid; qq record; v_res jsonb; v_st text; n int;
begin
  v_t := iniciar_tentativa('a0000000-0000-0000-0000-000000000001');
  v_t2 := iniciar_tentativa('a0000000-0000-0000-0000-000000000001');
  assert v_t = v_t2, 'iniciar de novo deve devolver a mesma tentativa aberta';
  for qq in select id, numero from prova_questoes order by numero loop
    if qq.numero = 1 then perform responder_questao(v_t, qq.id, 'A', false, false, '', 100, 1); end if;      -- certa
    if qq.numero = 2 then perform responder_questao(v_t, qq.id, 'B', true, true, 'A', 200, 2); end if;       -- vai ser certa, no chute
    if qq.numero = 3 then perform responder_questao(v_t, qq.id, 'A', false, false, 'B', 150, 3); end if;     -- errada (tempo menor não volta o relógio)
    -- 4: em branco; 5: anulada
  end loop;
  assert (select tempo_seg from prova_tentativas where id = v_t) = 200, 'tempo não pode voltar';
  assert (select atual from prova_tentativas where id = v_t) = 3;
  perform responder_questao(v_t, null, null, null, null, null, 300, 4);
  assert (select tempo_seg from prova_tentativas where id = v_t) = 300;
  begin perform responder_questao(v_t, gen_random_uuid(), 'A', false, false, '', 1, 1); assert false, 'questão de outra prova devia falhar';
  exception when raise_exception then null; end;

  perform entregar_tentativa(v_t, 310);
  v_st := responder_questao(v_t, (select id from prova_questoes where numero = 1), 'B', false, false, '', 999, 1);
  assert v_st = 'entregue', 'depois de entregue não muda';
  assert (select alternativa from prova_respostas r join prova_questoes q on q.id = r.questao_id where q.numero = 1) = 'A';

  begin perform corrigir_tentativa(v_t, '2026-10-03', 32, 4, 2, '{}'); assert false, 'sem gabarito da 2 devia falhar';
  exception when raise_exception then null; end;
  n := atualizar_questoes_da_prova('a0000000-0000-0000-0000-000000000001', '[{"numero":2,"gabarito":"B"},{"numero":3,"area":"clinica"}]');
  assert n = 2;
  assert (select area from prova_questoes where numero = 3) = 'clinica' and (select gabarito from prova_questoes where numero = 3) = 'B', 'só muda o campo enviado';

  begin perform corrigir_tentativa(v_t, '2026-10-03', 32, 4, 3, '{}'); assert false, 'conta errada devia falhar';
  exception when raise_exception then null; end;
  assert not exists (select 1 from mock_exams), 'a falha não pode deixar nada gravado';

  v_res := corrigir_tentativa(v_t, '2026-10-03', 32, 4, 2, jsonb_build_object((select id from prova_questoes where numero = 3)::text, 'texto da Q3'));
  assert (v_res ->> 'total')::int = 4 and (v_res ->> 'acertos')::int = 2 and (v_res ->> 'caderno')::int = 3, v_res::text;
  assert (select status from prova_tentativas where id = v_t) = 'corrigida';
  assert (select count(*) from mock_exams where nome = 'UEPA 2022' and total = 4 and acertos = 2 and tempo_min = 6 and xp_ganho = 32) = 1;
  assert (select jsonb_array_length(por_disciplina) from mock_exams) = 3, (select por_disciplina::text from mock_exams);   -- preventiva, pediatria, clinica
  assert (select count(*) from question_sets where mock_exam_id is not null and total = 4) = 1;
  assert (select count(*) from question_answers) = 4, 'uma por questão válida';
  assert (select count(*) from error_notebook) = 3, 'errada + branco + chute certo';
  assert (select count(*) from error_notebook where motivo = 'chute') = 1 and (select count(*) from error_notebook where motivo is null) = 2;
  assert (select enunciado from error_notebook e join prova_respostas r on r.erro_id = e.id join prova_questoes q on q.id = r.questao_id where q.numero = 3) = 'texto da Q3';
  assert (select enunciado from error_notebook e join prova_respostas r on r.erro_id = e.id join prova_questoes q on q.id = r.questao_id where q.numero = 4) = 'UEPA 2022 · Questão 4';
  assert (select xp from profiles) = 32 and (select questoes from daily_stats where data = '2026-10-03') = 4 and (select minutos from daily_stats) = 6;
  assert (select status from schedule_items) = 'concluido', 'simulado planejado do dia fica concluído';
  assert (corrigir_tentativa(v_t, '2026-10-03', 32, 4, 2, '{}') ->> 'ja_corrigida')::boolean, 'corrigir duas vezes não duplica';
  assert (select count(*) from mock_exams) = 1;

  v_t2 := iniciar_tentativa('a0000000-0000-0000-0000-000000000001');
  assert v_t2 <> v_t, 'depois de corrigida, refazer abre outra tentativa';

  -- caderno: classificar o erro depois
  update error_notebook set motivo = 'falta_conteudo', discipline_id = 'd0000000-0000-0000-0000-000000000001' where motivo is null and enunciado = 'texto da Q3';
  -- excluir o simulado devolve o XP e não apaga o caderno
  perform excluir_simulado((select id from mock_exams));
  assert (select xp from profiles) = 0 and (select count(*) from error_notebook) = 3;
  assert (select mock_exam_id from prova_tentativas where id = v_t) is null;
end $$;

-- RLS: a outra pessoa não vê nada e não consegue mexer
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  assert (select count(*) from provas) = 0 and (select count(*) from prova_questoes) = 0 and (select count(*) from prova_respostas) = 0;
  begin perform iniciar_tentativa('a0000000-0000-0000-0000-000000000001'); assert false, 'prova de outra pessoa';
  exception when raise_exception then null; end;
  assert atualizar_questoes_da_prova('a0000000-0000-0000-0000-000000000001', '[{"numero":1,"gabarito":"B"}]') = 0;
end $$;
reset role;
select 'OK: 0028 provas' as resultado;
