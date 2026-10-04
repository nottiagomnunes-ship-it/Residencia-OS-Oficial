-- Teste da 0040 num Postgres local (NÃO rode no Supabase), depois de 0037/0039 (antes do 0036). 1111 = administradora; 2222 = estudante.
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;

-- estudante não mexe na lista de temas, mas lê
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ begin
  begin insert into temas (especialidade, nome) values ('X', 'Y'); assert false; exception when insufficient_privilege then null; end;
end $$;
-- a estudante tem a disciplina "Anestesiologia" com o assunto "Bloqueios periféricos" (os nomes dela)
delete from disciplines where nome_normal(nome) = 'anestesiologia';
insert into disciplines (id, user_id, nome) values ('d2000000-0000-0000-0000-0000000000a2', auth.uid(), 'anestesiologia') on conflict do nothing;
insert into topics (id, user_id, discipline_id, nome) values ('e2000000-0000-0000-0000-0000000000b2', auth.uid(), 'd2000000-0000-0000-0000-0000000000a2', 'Bloqueios periféricos') on conflict do nothing;
reset role;

select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
insert into temas (id, area, especialidade, nome) values
  ('7e000000-0000-0000-0000-000000000001', 'cirurgia', 'Anestesiologia', 'Via aérea difícil'),
  ('7e000000-0000-0000-0000-000000000002', 'cirurgia', 'Anestesiologia', 'Bloqueios periféricos');
do $$ begin
  begin insert into temas (especialidade, nome) values ('ANESTESIOLOGIA', 'via aerea dificil'); assert false; exception when unique_violation then null; end;
end $$;
select importar_banco('[{"hash":"t1","blocos":[{"tipo":"texto","texto":"T1"}],"alternativas":[{"letra":"A","texto":"a"},{"letra":"B","texto":"b"}],"gabarito":"A","assunto":"Anestesiologia","comentario":"meu"}]');
update banco_questoes set tema_id = '7e000000-0000-0000-0000-000000000001', assunto = 'Via aérea difícil' where hash = 't1';
do $$ declare r jsonb; begin
  r := publicar_no_banco_geral((select jsonb_agg(jsonb_build_object('id', id)) from banco_questoes where hash = 't1'), null);
  assert (select tema_id = '7e000000-0000-0000-0000-000000000001' and disciplina = 'Anestesiologia' and assunto = 'Via aérea difícil' and area = 'cirurgia'
            from banco_geral where hash = 't1'), 'tema, especialidade e área do tema vão para o geral';
end $$;
reset role;

-- estudante recebe com o tema; a disciplina liga pelo nome da especialidade (o assunto dela tem outro nome: fica só a etiqueta)
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ begin
  perform sincronizar_banco_geral();
  assert (select b.tema_id = '7e000000-0000-0000-0000-000000000001' and b.assunto = 'Via aérea difícil' and nome_normal(d.nome) = 'anestesiologia'
            and b.topic_id is null and b.comentario is null from banco_questoes b join disciplines d on d.id = b.discipline_id where b.hash = 't1'), 'cópia com o tema';
end $$;
update banco_questoes set vezes = 3 where hash = 't1'; -- histórico dela
reset role;

-- administradora troca o tema e publica de novo: a cópia troca o tema e o assunto, liga ao assunto dela de mesmo nome, e o histórico fica
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
update banco_questoes set tema_id = '7e000000-0000-0000-0000-000000000002', assunto = 'Bloqueios periféricos' where hash = 't1';
select publicar_no_banco_geral((select jsonb_agg(jsonb_build_object('id', id)) from banco_questoes where hash = 't1'), null);
reset role;
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
set role authenticated;
do $$ declare r jsonb; begin
  r := sincronizar_banco_geral();
  assert (r->>'corrigidas')::int = 1, r::text;
  assert (select tema_id = '7e000000-0000-0000-0000-000000000002' and assunto = 'Bloqueios periféricos' and topic_id = 'e2000000-0000-0000-0000-0000000000b2' and vezes = 3
            from banco_questoes where hash = 't1'), 'tema novo, ligada ao assunto dela, histórico intacto';
end $$;
reset role;

-- apagar um tema: as questões perdem só a etiqueta
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
delete from temas where id = '7e000000-0000-0000-0000-000000000002';
reset role;
do $$ begin assert (select count(*) from banco_questoes where hash = 't1' and tema_id is null) = 2; end $$;
select 'OK 0040';
