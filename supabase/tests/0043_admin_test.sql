-- Teste da 0043 num Postgres local (NÃO rode no Supabase), depois de 0042 (antes do 0036).
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
select importar_banco('[{"hash":"p1","blocos":[{"tipo":"texto","texto":"P1"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A"}]');
select publicar_no_banco_geral((select jsonb_agg(jsonb_build_object('id', id)) from banco_questoes where hash = 'p1'), null);
do $$ begin assert not (select pendente_publicar from banco_questoes where hash = 'p1'), 'recém-publicada: em dia'; end $$;
update banco_questoes set vezes = vezes + 0, acertos = acertos where hash = 'p1';
do $$ begin assert not (select pendente_publicar from banco_questoes where hash = 'p1'), 'mexer no histórico não conta'; end $$;
-- a alteração precisa ser depois da publicação (em transações diferentes no app; aqui forçamos o tempo)
update banco_questoes set sincronizada_em = now() - interval '1 minute' where hash = 'p1';
update banco_questoes set gabarito = 'B' where hash = 'p1';
do $$ begin assert (select pendente_publicar from banco_questoes where hash = 'p1'), 'gabarito mudou: falta publicar'; end $$;
select publicar_no_banco_geral((select jsonb_agg(jsonb_build_object('id', id)) from banco_questoes where hash = 'p1'), null);
do $$ begin assert not (select pendente_publicar from banco_questoes where hash = 'p1'), 'publicada de novo: em dia'; end $$;
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ begin
  perform sincronizar_banco_geral();
  assert (select gabarito = 'B' and not pendente_publicar from banco_questoes where hash = 'p1'), 'cópia corrigida e sem pendência';
end $$;
reset role;
select 'OK 0043';
