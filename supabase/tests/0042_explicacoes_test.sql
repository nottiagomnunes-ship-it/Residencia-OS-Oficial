-- Teste da 0042 num Postgres local (NÃO rode no Supabase), depois de 0037..0040 (antes do 0036). 1111 = administradora; 2222 e 4444 = estudantes.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
select importar_banco('[{"hash":"x1","blocos":[{"tipo":"texto","texto":"X1"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A","comentario":"do cursinho"}]');
update banco_questoes set explicacao = 'A está certa porque...', explicacao_origem = 'ia' where hash = 'x1';
select publicar_no_banco_geral((select jsonb_agg(jsonb_build_object('id', id)) from banco_questoes where hash = 'x1'), null);
do $$ begin
  assert (select explicacao = 'A está certa porque...' and explicacao_origem = 'ia' from banco_geral where hash = 'x1'), 'explicação vai para o geral';
  assert not exists (select 1 from information_schema.columns where table_name = 'banco_geral' and column_name = 'comentario'), 'comentário continua sem ir';
end $$;
reset role;

select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ begin
  perform sincronizar_banco_geral();
  assert (select explicacao = 'A está certa porque...' and comentario is null from banco_questoes where hash = 'x1'), 'estudante recebe a explicação, não o comentário';
end $$;
insert into explicacao_reportes (user_id, hash, motivo) values (auth.uid(), 'x1', 'A alternativa B também está certa');
reset role;

select set_config('request.jwt.claim.sub', '44444444-4444-4444-4444-444444444444', false);
set role authenticated;
do $$ begin
  assert (select count(*) from explicacao_reportes) = 0, 'estudante não vê o reporte de outra pessoa';
  begin insert into explicacao_reportes (user_id, hash, motivo) values ('22222222-2222-2222-2222-222222222222', 'x1', 'fingindo'); assert false; exception when insufficient_privilege then null; end;
end $$;
reset role;

-- administradora vê, corrige, marca como resolvido e publica de novo: a cópia recebe a explicação corrigida
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
do $$ begin
  assert (select count(*) from explicacao_reportes where resolvido_em is null) = 1;
  update explicacao_reportes set resolvido_em = now();
  update banco_questoes set explicacao = 'Corrigida', explicacao_origem = 'revisada' where hash = 'x1';
  perform publicar_no_banco_geral((select jsonb_agg(jsonb_build_object('id', id)) from banco_questoes where hash = 'x1'), null);
end $$;
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ declare r jsonb; begin
  r := sincronizar_banco_geral();
  assert (r->>'corrigidas')::int = 1, r::text;
  assert (select explicacao = 'Corrigida' and explicacao_origem = 'revisada' from banco_questoes where hash = 'x1');
end $$;
reset role;
select 'OK 0042';
