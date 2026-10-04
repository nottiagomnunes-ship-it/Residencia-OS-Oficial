-- Teste da 0036 num Postgres local (NÃO rode no Supabase), depois dos outros testes (apaga os dados da pessoa 1111...).
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
-- a outra pessoa tem dados que NÃO podem sumir
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
insert into disciplines (user_id, nome) values (auth.uid(), 'Da outra pessoa');
reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
update profiles set nome = 'Tiago', onboarded = true, xp = 500, level = 2, exam_date = '2027-03-01', tutorial_visto_em = now();
do $$ declare r jsonb; antes int; begin
  antes := (select count(*) from disciplines) + (select count(*) from provas) + (select count(*) from banco_questoes) + (select count(*) from error_notebook);
  assert antes > 0, 'precisa ter dados para o teste';
  r := apagar_tudo();
  assert (r->>'apagados')::int > 0, r::text;
  assert (select count(*) from disciplines) = 0 and (select count(*) from topics) = 0 and (select count(*) from provas) = 0 and (select count(*) from prova_questoes) = 0
     and (select count(*) from banco_questoes) = 0 and (select count(*) from error_notebook) = 0 and (select count(*) from question_sets) = 0 and (select count(*) from mock_exams) = 0
     and (select count(*) from commitments) = 0 and (select count(*) from daily_stats) = 0 and (select count(*) from schedule_items) = 0 and (select count(*) from reviews) = 0;
  assert (select nome is null and not onboarded and xp = 0 and level = 1 and exam_date is null and tutorial_visto_em is null and daily_minutes = 240 from profiles), 'perfil voltou ao padrão';
  assert (select count(*) from profiles) = 1, 'a conta continua';
end $$;
reset role;
do $$ begin assert (select count(*) from disciplines where nome = 'Da outra pessoa') = 1, 'dados de outra pessoa intactos'; end $$;
select 'OK 0036';
