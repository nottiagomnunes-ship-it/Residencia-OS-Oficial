-- Teste da 0046 num Postgres local (NÃO rode no Supabase), depois da 0037 (1111 = administradora; 2222 = estudante).
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
insert into mensagens (tipo, texto, pagina) values ('problema', 'A figura da questão não abre', '/banco/questoes');
do $$ begin
  begin insert into mensagens (tipo, texto, resposta) values ('sugestao', 'Oi', 'eu mesmo respondo'); assert false; exception when insufficient_privilege then null; end;
  begin insert into mensagens (user_id, tipo, texto) values ('11111111-1111-1111-1111-111111111111', 'outro', 'em nome de outro'); assert false; exception when insufficient_privilege then null; end;
  begin insert into mensagens (tipo, texto) values ('elogio', 'tipo inválido'); assert false; exception when check_violation then null; end;
  update mensagens set resolvida_em = now(); -- estudante não altera (nenhuma linha muda)
  assert (select count(*) from mensagens where resolvida_em is not null) = 0;
  assert (select count(*) from mensagens) = 1, 'vê a própria';
end $$;
insert into erros_app (origem, mensagem, pagina) values ('navegador', 'TypeError: x is undefined', '/inicio');
do $$ begin
  begin insert into erros_app (origem, mensagem) values ('servidor', 'fingindo ser o servidor'); assert false; exception when insufficient_privilege then null; end;
  assert (select count(*) from erros_app) = 0, 'estudante não lê os erros';
end $$;
-- limite: 10 mensagens por hora
do $$ declare i int; begin
  for i in 1..9 loop insert into mensagens (tipo, texto) values ('sugestao', 'sugestão ' || i); end loop;
  begin insert into mensagens (tipo, texto) values ('sugestao', 'a 11ª'); assert false; exception when raise_exception then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
do $$ begin
  assert (select count(*) from mensagens) = 10, 'admin vê todas';
  update mensagens set resposta = 'Corrigido, obrigado!', respondida_em = now(), resolvida_em = now() where texto like 'A figura%';
  assert (select count(*) from erros_app) = 1, 'admin vê os erros';
  delete from erros_app; assert (select count(*) from erros_app) = 0;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ begin assert (select resposta from mensagens where texto like 'A figura%') = 'Corrigido, obrigado!', 'quem enviou vê a resposta'; end $$;
reset role;
select 'OK 0046';
