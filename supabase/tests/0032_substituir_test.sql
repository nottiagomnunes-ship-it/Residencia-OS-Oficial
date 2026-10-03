-- Teste da 0032 num Postgres local (NÃO rode no Supabase), depois das migrações e de 0028_provas_test.sql.
\set ON_ERROR_STOP 1
\i /home/claude/proj/supabase/migrations/0032_substituir_agenda.sql
\i /home/claude/proj/supabase/migrations/0032_substituir_agenda.sql
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
delete from commitments;
insert into commitments (user_id, titulo, tipo, dias, data, hora_ini, hora_fim, agenda, categoria) values
  (auth.uid(), 'Velho seg', 'pontual', '{}', '2026-10-05', '07:00', '13:00', true, 'internato'),
  (auth.uid(), 'Velho dom', 'pontual', '{}', '2026-10-11', '07:00', '13:00', true, 'internato'),
  (auth.uid(), 'Outra semana', 'pontual', '{}', '2026-10-12', '07:00', '13:00', true, 'internato'),
  (auth.uid(), 'Academia', 'semanal', '{1,3}', null, '18:00', '19:00', true, 'academia'),
  (auth.uid(), 'Antigo fora da agenda', 'pontual', '{}', '2026-10-06', '07:00', '13:00', false, 'outro');
set role authenticated;
select substituir_agenda_semana('2026-10-05', '2026-10-11', '[{"titulo":"UBS","categoria":"internato","data":"2026-10-06","hora_ini":"07:00","hora_fim":"13:00"}]');
reset role;
do $$ begin
  assert (select array_agg(titulo order by titulo) from commitments) = array['Academia','Antigo fora da agenda','Outra semana','UBS'], (select array_agg(titulo order by titulo) from commitments)::text;
  begin perform substituir_agenda_semana('2026-10-11', '2026-10-05', '[]'); assert false; exception when raise_exception then null; end;
end $$;
-- falha no meio desfaz tudo (hora inválida): nada é apagado
set role authenticated;
do $$ begin
  begin perform substituir_agenda_semana('2026-10-05', '2026-10-11', '[{"titulo":"X","data":"2026-10-06","hora_ini":"99:00","hora_fim":"13:00"}]'); assert false;
  exception when others then null; end;
end $$;
reset role;
do $$ begin assert exists (select 1 from commitments where titulo = 'UBS'), 'falha apagou dados'; end $$;
select 'OK 0032';
