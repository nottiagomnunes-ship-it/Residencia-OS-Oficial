-- Teste da 0045 num Postgres local (NÃO rode no Supabase), depois de 0034/0035/0039. Conta 1111 (tem as questões h1..h4 dos testes anteriores).
\set ON_ERROR_STOP 1
grant all on all tables in schema public to authenticated;
grant execute on all functions in schema public to authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);
set role authenticated;
-- duas questões com enunciado de verdade (o começo do texto identifica a questão nos erros antigos)
select importar_banco('[{"hash":"c1","blocos":[{"tipo":"imagem","caminho":"x/banco/f.png"},{"tipo":"texto","texto":"Paciente de 60 anos com palpitações e ECG com QRS largo, regular, a 180 bpm."}],"alternativas":[{"letra":"A","texto":"TV"},{"letra":"B","texto":"TSV"}],"gabarito":"A"},
                        {"hash":"c2","blocos":[{"tipo":"texto","texto":"Gestante de 30 semanas com cefaleia, PA 160 x 110 mmHg e proteinúria. Qual a conduta?"}],"alternativas":[{"letra":"A","texto":"Sulfato de magnésio"},{"letra":"B","texto":"Alta"}],"gabarito":"A"}]');
do $$ declare r jsonb; c1 uuid; begin
  select id into c1 from banco_questoes where hash = 'c1';
  -- Praticar: o erro novo já guarda a questão
  r := responder_pratica(c1, 'B', false, '2026-10-06', 'UFMA 2024' || chr(10) || 'Paciente de 60 anos com palpitações e ECG com QRS largo, regular, a 180 bpm.');
  assert (select banco_questao_id from error_notebook where id = (r->>'erro_id')::uuid) = c1, 'Praticar liga o erro à questão';
  -- erros antigos (sem ligação): um que acha UMA questão, um curto demais, um que não acha nada
  insert into error_notebook (user_id, enunciado, motivo) values
    (auth.uid(), 'Banco de questões' || chr(10) || 'Gestante de 30 semanas com cefaleia, PA 160 x 110 mmHg e proteinúria. Qual a conduta?' || chr(10) || 'A) Sulfato de magnésio', null),
    (auth.uid(), 'Q2 alguma coisa', null),
    (auth.uid(), 'Questão que não está no banco: nada a ver com as outras do teste', null);
end $$;
-- os erros das listas (teste 0034) foram corrigidos já com a 0045: ligados pela lista
do $$ begin
  assert not exists (select 1 from error_notebook e join prova_respostas x on x.erro_id = e.id join prova_questoes q on q.id = x.questao_id
                      where q.banco_questao_id is not null and e.banco_questao_id is distinct from q.banco_questao_id), 'lista liga o erro à questão';
end $$;
reset role;
\ir ../migrations/0045_caderno_questao.sql
do $$ begin
  assert (select banco_questao_id from error_notebook where enunciado like 'Banco de questões%Gestante%') = (select id from banco_questoes where hash = 'c2'), 'erro antigo do Praticar ligado pelo texto';
  assert (select banco_questao_id from error_notebook where enunciado = 'Q2 alguma coisa') is null, 'texto curto demais não liga (evita falso positivo)';
  assert (select banco_questao_id from error_notebook where enunciado like 'Questão que não está%') is null;
end $$;
-- apagar a questão do banco não apaga o erro (só desfaz a ligação)
delete from banco_questoes where hash = 'c2';
do $$ begin assert exists (select 1 from error_notebook where enunciado like 'Banco de questões%Gestante%' and banco_questao_id is null); end $$;
select 'OK 0045';
