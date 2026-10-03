-- Teste da 0031 num Postgres local (NÃO rode no Supabase), depois das migrações 0001..0030 e de 0028_provas_test.sql.
\set ON_ERROR_STOP 1
\i /home/claude/proj/supabase/migrations/0031_tutorial.sql
-- contas que já existiam: marcadas como vistas
do $$ begin assert not exists (select 1 from profiles where tutorial_visto_em is null), 'contas antigas não podem ver o tutorial'; end $$;
-- conta nova depois da migração: sem marca (vê o tutorial)
insert into auth.users values ('33333333-3333-3333-3333-333333333333', 'nova@x');
do $$ begin assert (select tutorial_visto_em from profiles where id = '33333333-3333-3333-3333-333333333333') is null; end $$;
-- rodar de novo não marca a conta nova
\i /home/claude/proj/supabase/migrations/0031_tutorial.sql
do $$ begin assert (select tutorial_visto_em from profiles where id = '33333333-3333-3333-3333-333333333333') is null, 'rerun marcou conta nova'; end $$;
select 'OK 0031';
