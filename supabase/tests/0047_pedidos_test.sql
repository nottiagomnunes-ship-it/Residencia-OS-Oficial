-- Teste da 0047 num Postgres local (NÃO rode no Supabase), depois da 0046 (1111 = administradora; 2222 = estudante).
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
delete from mensagens; -- o teste da 0046 deixou 10 mensagens (limite por hora)
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
insert into mensagens (tipo, texto, banca, ano, anexo) values ('prova', 'Pedido de prova', 'UFMA', 2024, '22222222-2222-2222-2222-222222222222/pedidos/a.pdf');
insert into mensagens (tipo, texto, banca) values ('prova', 'Sem PDF', 'USP-SP');
do $$ begin
  begin insert into mensagens (tipo, texto, banca, anexo) values ('prova', 'PDF de outra pessoa', 'X', '11111111-1111-1111-1111-111111111111/pedidos/b.pdf'); assert false; exception when insufficient_privilege then null; end;
  begin insert into mensagens (tipo, texto, banca) values ('sugestao', 'banca só em pedido de prova', 'X'); assert false; exception when insufficient_privilege then null; end;
  begin insert into mensagens (tipo, texto, banca, ano) values ('prova', 'ano estranho', 'X', 1500); assert false; exception when check_violation then null; end;
  assert (select count(*) from mensagens where tipo = 'prova') = 2;
end $$;
reset role;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
do $$ begin
  assert (select count(*) from mensagens where tipo = 'prova') = 2, 'admin vê os pedidos';
  update mensagens set resolvida_em = now(), resposta = 'Já está no banco', anexo = null where banca = 'UFMA';
  assert (select anexo from mensagens where banca = 'UFMA') is null;
end $$;
reset role;
select 'OK 0047';
