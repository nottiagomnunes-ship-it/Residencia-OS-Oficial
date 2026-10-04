-- Teste da 0039 num Postgres local (NÃO rode no Supabase), depois dos testes 0028..0035 e 0037 (antes do 0036).
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
select importar_banco('[{"hash":"r1","blocos":[{"tipo":"texto","texto":"R1"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A"},
                        {"hash":"r2","blocos":[{"tipo":"texto","texto":"R2"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A"}]');
do $$ declare v1 uuid := (select id from banco_questoes where hash = 'r1'); v2 uuid := (select id from banco_questoes where hash = 'r2'); r jsonb;
begin
  delete from revisao_questoes;
  -- acertar uma que nunca errou: não entra na fila
  r := responder_pratica(v2, 'A', false, hoje_br(), 'x');
  assert not exists (select 1 from revisao_questoes where questao_id = v2), 'acerto não entra';
  -- errou: refazer amanhã
  r := responder_pratica(v1, 'B', false, hoje_br(), 'x');
  assert (select etapa = 0 and proxima = hoje_br() + 1 and erros = 1 from revisao_questoes where questao_id = v1), 'erro: amanhã';
  -- acertou antes do dia: não anda
  r := responder_pratica(v1, 'A', false, hoje_br(), 'x');
  assert (select etapa from revisao_questoes where questao_id = v1) = 0, 'antes do dia não conta';
  -- no dia: 1 → 7 → 30 → concluída
  update revisao_questoes set proxima = hoje_br() where questao_id = v1;
  r := responder_pratica(v1, 'A', false, hoje_br(), 'x');
  assert (select etapa = 1 and proxima = hoje_br() + 7 from revisao_questoes where questao_id = v1), 'acertou: 7 dias';
  update revisao_questoes set proxima = hoje_br() - 2 where questao_id = v1; -- atrasada também vale
  r := responder_pratica(v1, 'A', false, hoje_br(), 'x');
  assert (select etapa = 2 and proxima = hoje_br() + 30 from revisao_questoes where questao_id = v1), 'acertou de novo: 30 dias';
  update revisao_questoes set proxima = hoje_br() where questao_id = v1;
  -- errou na etapa 2: recomeça
  r := responder_pratica(v1, 'B', false, hoje_br(), 'x');
  assert (select etapa = 0 and proxima = hoje_br() + 1 and erros = 2 from revisao_questoes where questao_id = v1), 'errou: recomeça';
  update revisao_questoes set etapa = 2, proxima = hoje_br() where questao_id = v1;
  r := responder_pratica(v1, 'A', false, hoje_br(), 'x');
  assert (select etapa = 3 and proxima is null from revisao_questoes where questao_id = v1), 'terceiro acerto: sai da fila';
  -- chute certo: entra pela refazer_chutes (só as próprias)
  assert refazer_chutes(array[v2, '00000000-0000-0000-0000-000000000000'::uuid]) = 1;
  assert (select etapa = 0 and proxima = hoje_br() + 1 from revisao_questoes where questao_id = v2);
end $$;
reset role;
-- RLS: a outra pessoa não vê a fila
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
do $$ begin assert not exists (select 1 from revisao_questoes where user_id = '22222222-2222-2222-2222-222222222222'); end $$;
reset role;
select 'OK 0039';
