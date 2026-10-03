-- Teste da 0029 num Postgres local (NÃO rode no Supabase): rode depois de 0028_provas_test.sql (usa a pessoa criada lá), com "delete from commitments" antes.
\set ON_ERROR_STOP 1
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
insert into commitments (user_id, titulo, hora_ini, hora_fim, dias) values (auth.uid(), 'antigo', '07:00', '13:00', '{1}');
insert into commitments (user_id, titulo, hora_ini, hora_fim, dias, categoria, agenda) values (auth.uid(), 'Academia', '18:00', '19:00', '{1,3}', 'academia', true);
do $$ begin
  assert (select count(*) from commitments where agenda) = 1 and (select categoria from commitments where titulo = 'antigo') = 'outro';
  begin insert into commitments (user_id, titulo, hora_ini, hora_fim, categoria) values (auth.uid(), 'x', '01:00', '02:00', 'festa'); assert false;
  exception when check_violation then null; end;
end $$;
-- restaurar backup com as colunas novas continua funcionando
set role authenticated;
select aplicar_backup(jsonb_build_object('commitments', jsonb_build_array(jsonb_build_object('titulo','Plantão','tipo','pontual','data','2026-10-10','hora_ini','19:00','hora_fim','07:00','categoria','plantao','agenda',true))), null);
reset role;
do $$ begin assert (select count(*) from commitments) = 1 and (select agenda from commitments) and (select categoria from commitments) = 'plantao'; end $$;
select 'OK 0029';
