-- Caderno de Erros ligado à questão do banco: cada erro do Praticar ou de uma lista guarda QUAL questão foi (banco_questao_id), para o caderno
-- mostrar a questão original (com as figuras), o tema, "Refazer esta questão" e onde ela está na fila de refazer.
-- Os erros antigos são ligados aqui mesmo: os das listas pela própria lista; os do Praticar pelo texto (o começo do enunciado guardado no caderno
-- tem que achar UMA questão só do seu banco). Pode ser executada mais de uma vez (depois da 0039).

alter table error_notebook add column if not exists banco_questao_id uuid references banco_questoes on delete set null;
create index if not exists error_notebook_banco_questao on error_notebook (banco_questao_id);

-- Praticar: o erro guarda a questão
create or replace function responder_pratica(p_questao uuid, p_alt text, p_chute boolean, p_dia date, p_texto text)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_uid uuid := auth.uid(); q record; s record; v_certa boolean; v_set uuid; v_xp_antes int := 0; v_xp int; v_ans uuid; v_err uuid; v_bloco uuid;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  if p_alt is null or p_alt not in ('A', 'B', 'C', 'D', 'E') then raise exception 'Alternativa inválida'; end if;
  select * into q from banco_questoes where id = p_questao and user_id = v_uid;
  if not found then raise exception 'Questão não encontrada'; end if;
  if q.anulada or q.gabarito is null then raise exception 'Questão sem gabarito'; end if;
  v_certa := p_alt = q.gabarito;

  -- a sessão de prática do dia para esta disciplina/assunto (cria na primeira resposta)
  select * into s from question_sets
   where user_id = v_uid and realizado_em = p_dia and prova = 'Praticar' and mock_exam_id is null
     and discipline_id is not distinct from q.discipline_id and topic_id is not distinct from q.topic_id
   order by id limit 1 for update;
  if found then
    v_set := s.id; v_xp_antes := coalesce(s.xp_ganho, 0);
    update question_sets set total = total + 1, acertos = acertos + (case when v_certa then 1 else 0 end) where id = v_set;
  else
    insert into question_sets (user_id, discipline_id, topic_id, banca, prova, total, acertos, realizado_em, xp_ganho)
      values (v_uid, q.discipline_id, q.topic_id, 'Banco de questões', 'Praticar', 1, case when v_certa then 1 else 0 end, p_dia, 0)
      returning id into v_set;
  end if;
  select xp_questoes(total, acertos) into v_xp from question_sets where id = v_set;
  update question_sets set xp_ganho = v_xp where id = v_set;
  perform registrar_dia(p_dia, v_xp - v_xp_antes, 0, 1, case when v_certa then 1 else 0 end);

  insert into question_answers (user_id, question_set_id, correta, ref_questao)
    values (v_uid, v_set, v_certa, left(coalesce(q.banca || coalesce(' ' || q.ano, ''), 'Banco de questões'), 100)) returning id into v_ans;
  if not v_certa or coalesce(p_chute, false) then
    insert into error_notebook (user_id, discipline_id, topic_id, question_answer_id, enunciado, motivo, banco_questao_id)
      values (v_uid, q.discipline_id, q.topic_id, v_ans, left(coalesce(p_texto, 'Banco de questões'), 20000), case when p_chute then 'chute' end, q.id)
      returning id into v_err;
  end if;
  update banco_questoes set vezes = vezes + 1, acertos = acertos + (case when v_certa then 1 else 0 end), ultima_em = now(), ultimo_certo = v_certa where id = q.id;

  -- um bloco "Questões" do dia que já foi atingido pela prática fica concluído
  select id into v_bloco from schedule_items i where i.user_id = v_uid and i.tipo = 'questoes' and i.data = p_dia and i.status <> 'concluido'
     and (select coalesce(sum(total), 0) from question_sets where user_id = v_uid and realizado_em = p_dia and prova = 'Praticar') >= coalesce(i.qtd_questoes, 0)
   order by hora_ini nulls last limit 1;
  if v_bloco is not null then update schedule_items set status = 'concluido' where id = v_bloco; end if;

  return jsonb_build_object('correta', v_certa, 'gabarito', q.gabarito, 'gabarito_origem', q.gabarito_origem, 'comentario', q.comentario, 'erro_id', v_err, 'xp', v_xp - v_xp_antes);
end $$;

-- Listas montadas do banco: o erro guarda a questão
create or replace function corrigir_lista(p_tentativa uuid, p_dia date, p_xp int, p_total int, p_acertos int, p_textos jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_uid uuid := auth.uid(); t record; p record; r record; g record;
  v_total int; v_acertos int; v_min int; v_set uuid; v_ans uuid; v_err uuid; v_cad int := 0; v_bloco uuid;
begin
  select * into t from prova_tentativas where id = p_tentativa and user_id = v_uid for update;
  if not found then raise exception 'Tentativa não encontrada'; end if;
  select * into p from provas where id = t.prova_id;
  if p.tipo <> 'lista' then raise exception 'Não é uma lista'; end if;
  if t.status = 'corrigida' then return jsonb_build_object('ja_corrigida', true); end if;
  if exists (select 1 from prova_questoes where prova_id = t.prova_id and not anulada and gabarito is null) then raise exception 'Falta o gabarito de alguma questão'; end if;

  insert into prova_respostas (user_id, tentativa_id, questao_id) select v_uid, t.id, q.id from prova_questoes q where q.prova_id = t.prova_id
    on conflict (tentativa_id, questao_id) do nothing;
  update prova_respostas x set correta = case when q.anulada then null else coalesce(x.alternativa = q.gabarito, false) end
    from prova_questoes q where q.id = x.questao_id and x.tentativa_id = t.id;
  select count(*) filter (where not q.anulada), count(*) filter (where x.correta) into v_total, v_acertos
    from prova_respostas x join prova_questoes q on q.id = x.questao_id where x.tentativa_id = t.id;
  if v_total < 1 then raise exception 'Todas as questões estão anuladas'; end if;
  if v_total <> p_total or v_acertos <> p_acertos then raise exception 'A correção mudou enquanto era gravada. Recarregue a página e tente de novo.'; end if;
  v_min := ceil(t.tempo_seg / 60.0)::int;

  -- uma sessão de questões por disciplina/assunto (é o que alimenta o Desempenho); o tempo vai inteiro na primeira
  for g in select q.discipline_id, q.topic_id, count(*) as total, count(*) filter (where x.correta) as acertos
             from prova_respostas x join prova_questoes q on q.id = x.questao_id
            where x.tentativa_id = t.id and not q.anulada group by q.discipline_id, q.topic_id order by count(*) desc loop
    insert into question_sets (user_id, discipline_id, topic_id, banca, prova, total, acertos, tempo_min, realizado_em, xp_ganho)
      values (v_uid, g.discipline_id, g.topic_id, 'Banco de questões', left(p.nome, 120), g.total, g.acertos, case when v_set is null then nullif(v_min, 0) end, p_dia,
              case when v_set is null then p_xp else 0 end)
      returning id into v_set;
    for r in select x.id, x.chute, x.correta, q.numero, q.discipline_id, q.topic_id, q.banco_questao_id
               from prova_respostas x join prova_questoes q on q.id = x.questao_id
              where x.tentativa_id = t.id and not q.anulada and q.discipline_id is not distinct from g.discipline_id and q.topic_id is not distinct from g.topic_id
              order by q.numero loop
      insert into question_answers (user_id, question_set_id, correta, ref_questao) values (v_uid, v_set, r.correta, left(p.nome, 100) || ' · Q' || r.numero)
        returning id into v_ans;
      if not r.correta or r.chute then
        insert into error_notebook (user_id, discipline_id, topic_id, question_answer_id, enunciado, motivo, banco_questao_id)
          values (v_uid, r.discipline_id, r.topic_id, v_ans, coalesce(p_textos ->> (select questao_id::text from prova_respostas where id = r.id), left(p.nome, 100) || ' · Questão ' || r.numero),
                  case when r.chute then 'chute' end, r.banco_questao_id)
          returning id into v_err;
        update prova_respostas set erro_id = v_err where id = r.id;
        v_cad := v_cad + 1;
      end if;
      if r.banco_questao_id is not null then
        update banco_questoes set vezes = vezes + 1, acertos = acertos + (case when r.correta then 1 else 0 end), ultima_em = now(), ultimo_certo = r.correta
         where id = r.banco_questao_id and user_id = v_uid;
      end if;
    end loop;
  end loop;

  perform registrar_dia(p_dia, p_xp, v_min, v_total, v_acertos);
  select id into v_bloco from schedule_items where user_id = v_uid and tipo = 'questoes' and data = p_dia and status <> 'concluido'
    and v_total >= coalesce(qtd_questoes, 0) order by hora_ini nulls last limit 1;
  if v_bloco is not null then update schedule_items set status = 'concluido' where id = v_bloco; end if;
  update prova_tentativas set status = 'corrigida', corrigida_em = now(), entregue_em = coalesce(entregue_em, now()), total = v_total, acertos = v_acertos
   where id = t.id;
  return jsonb_build_object('total', v_total, 'acertos', v_acertos, 'caderno', v_cad);
end $$;

-- Erros antigos das listas: pela resposta da lista
update error_notebook e set banco_questao_id = q.banco_questao_id
  from prova_respostas x join prova_questoes q on q.id = x.questao_id
 where x.erro_id = e.id and e.banco_questao_id is null and q.banco_questao_id is not null;

-- Erros antigos do Praticar: pelo começo do primeiro trecho de texto do enunciado (só quando acha exatamente uma questão da mesma conta)
with candidatos as (
  select e.id as erro_id, b.id as questao_id, count(*) over (partition by e.id) as n
    from error_notebook e
    join banco_questoes b on b.user_id = e.user_id
   where e.banco_questao_id is null and e.enunciado is not null
     and length(coalesce(jsonb_path_query_first(b.blocos, '$[*] ? (@.tipo == "texto").texto') #>> '{}', '')) >= 30
     and strpos(e.enunciado, left(jsonb_path_query_first(b.blocos, '$[*] ? (@.tipo == "texto").texto') #>> '{}', 120)) > 0
)
update error_notebook e set banco_questao_id = c.questao_id from candidatos c where c.erro_id = e.id and c.n = 1;
