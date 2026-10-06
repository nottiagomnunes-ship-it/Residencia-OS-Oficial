-- Teste da 0049 num Postgres local (NÃO rode no Supabase), depois da 0048 (1111 = administradora; 2222 = estudante).
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ begin
  -- estudante: importar_banco recusa; salvar_prova não existe mais
  begin perform importar_banco('[{"hash":"zz1","blocos":[{"tipo":"texto","texto":"x"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}]}]'); assert false;
  exception when insufficient_privilege then null; end;
  assert not exists (select 1 from pg_proc where proname = 'salvar_prova'), 'salvar_prova removida';
  -- direto na tabela pela API: barrado
  perform set_config('request.path', '/banco_questoes', true);
  begin insert into banco_questoes (user_id, hash, blocos, alternativas) values (auth.uid(), 'zz2', '[]', '[]'); assert false;
  exception when insufficient_privilege then null; end;
  perform set_config('request.path', '/rest/v1/provas', true);
  begin insert into provas (user_id, nome) values (auth.uid(), 'Minha prova'); assert false; exception when insufficient_privilege then null; end;
  -- por uma função do app: continua (a prova TESTE 2025 do teste da 0048)
  perform set_config('request.path', '/rpc/montar_prova_do_banco', true);
  perform sincronizar_banco_geral();
  assert montar_prova_do_banco((select id from provas_geral where nome = 'TESTE 2025')) is not null, 'função do app continua inserindo';
  -- sem request.path (SQL Editor, servidor): nada muda
  perform set_config('request.path', '', true);
  insert into provas (user_id, nome) values (auth.uid(), 'pelo SQL');
end $$;
reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
do $$ begin
  perform set_config('request.path', '/banco_questoes', true);
  insert into banco_questoes (user_id, hash, blocos, alternativas) values (auth.uid(), 'zz3', '[{"tipo":"texto","texto":"x"}]', '[]'); -- administradora pode
  perform set_config('request.path', '', true);
  assert importar_banco('[{"hash":"zz4","blocos":[{"tipo":"texto","texto":"y"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}]}]') = 1, 'administradora importa';
end $$;
reset role;
select 'OK 0049';
