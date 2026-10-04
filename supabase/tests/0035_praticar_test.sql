-- Teste da 0035 num Postgres local (NÃO rode no Supabase), depois de 0034_banco_test.sql.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
do $$ declare r jsonb; xp0 int; q1 uuid; q2 uuid; q4 uuid; begin
  -- mesma regra do app (xpQuestoes): 10/8 → 6; 20/15 → 11; 3/3 → 1; 200/200 → 125; 300/0 → 100
  assert xp_questoes(10, 8) = 6 and xp_questoes(20, 15) = 11 and xp_questoes(3, 3) = 1 and xp_questoes(200, 200) = 125 and xp_questoes(300, 0) = 100 and xp_questoes(0, 0) = 0;
  select id into q1 from banco_questoes where hash = 'h1'; select id into q2 from banco_questoes where hash = 'h2'; select id into q4 from banco_questoes where hash = 'h4';
  xp0 := (select xp from profiles);
  delete from error_notebook where enunciado like 'pratica%';
  insert into schedule_items (user_id, tipo, titulo, data, qtd_questoes) values (auth.uid(), 'questoes', 'Questões', '2026-10-05', 2);
  r := responder_pratica(q1, 'A', false, '2026-10-05', 'pratica q1');           -- certa (h1 gabarito A)
  assert (r->>'correta')::boolean and r->>'gabarito' = 'A' and r->>'erro_id' is null, r::text;
  r := responder_pratica(q2, 'A', false, '2026-10-05', 'pratica q2');           -- errada (h2 gabarito B)
  assert not (r->>'correta')::boolean and r->>'gabarito' = 'B' and r->>'erro_id' is not null, r::text;
  r := responder_pratica(q1, 'A', true, '2026-10-05', 'pratica q1 chute');      -- certa no chute: vai pro caderno
  assert (r->>'erro_id') is not null;
  assert (select count(*) from question_sets where prova = 'Praticar' and realizado_em = '2026-10-05') = 1, 'uma sessão por dia e disciplina/assunto';
  assert (select total || '/' || acertos || '/' || xp_ganho from question_sets where prova = 'Praticar' and realizado_em = '2026-10-05') = '3/2/1';
  assert (select xp from profiles) = xp0 + 1, 'XP pela diferença';
  assert (select vezes || '/' || acertos from banco_questoes where id = q1) = '3/3'; -- já tinha 1/1 da lista do teste 0034
  assert (select count(*) from error_notebook where enunciado like 'pratica%' and discipline_id = 'd0000000-0000-0000-0000-0000000000aa') = 2;
  assert (select status from schedule_items where titulo = 'Questões' and data = '2026-10-05') = 'concluido';
  begin perform responder_pratica(q4, 'A', false, '2026-10-05', 'x'); assert false; exception when raise_exception then null; end;  -- anulada
  begin perform responder_pratica(q1, 'Z', false, '2026-10-05', 'x'); assert false; exception when raise_exception then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ begin begin perform responder_pratica((select id from banco_questoes limit 1), 'A', false, '2026-10-05', 'x'); assert false; exception when raise_exception then null; end; end $$;
reset role;
select 'OK 0035';
