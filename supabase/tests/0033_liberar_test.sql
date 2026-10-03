-- Teste da 0033 num Postgres local (NÃO rode no Supabase), depois das migrações e de 0028_provas_test.sql.
\set ON_ERROR_STOP 1
\i /home/claude/proj/supabase/migrations/0033_liberar_horario.sql
\i /home/claude/proj/supabase/migrations/0033_liberar_horario.sql
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
delete from commitments;
insert into commitments (user_id, titulo, tipo, dias, hora_ini, hora_fim, agenda) values (auth.uid(), 'Internato', 'semanal', '{1,2,3}', '07:00', '13:00', true);
set role authenticated;
update commitments set excecoes = array['2026-10-07']::date[] where titulo = 'Internato';
reset role;
do $$ begin assert (select excecoes from commitments) = array['2026-10-07']::date[]; assert (select column_default from information_schema.columns where table_name = 'commitments' and column_name = 'excecoes') = '''{}''::date[]'; end $$;
-- restaurar backup com o campo novo continua funcionando
set role authenticated;
select aplicar_backup(jsonb_build_object('commitments', jsonb_build_array(jsonb_build_object('titulo','A','tipo','semanal','dias', jsonb_build_array(1),'hora_ini','07:00','hora_fim','08:00','agenda',true,'excecoes', jsonb_build_array('2026-10-12')))), null);
reset role;
do $$ begin assert (select excecoes from commitments) = array['2026-10-12']::date[]; end $$;
select 'OK 0033';
