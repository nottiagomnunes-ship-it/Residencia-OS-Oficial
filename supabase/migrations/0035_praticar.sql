-- Praticar: responder questões do banco uma por vez, com a correção na hora (sem montar lista).
-- Cada resposta é gravada tudo ou nada: soma numa sessão de questões do dia (uma por disciplina/assunto, para o Desempenho), dá o XP pela
-- mesma regra de "Registrar questões" (só a diferença a cada resposta), conta a questão como feita e manda erro/chute para o Caderno.
-- Pode ser executada mais de uma vez.

-- Mesma regra de xpQuestoes() do app: 1 XP a cada 2 questões (até 200) + bônus por acerto alto (80%+: +1 a cada 8; 70–79%: +1 a cada 16).
create or replace function xp_questoes(p_total int, p_acertos int)
returns int language sql immutable as $$
  select (least(greatest(p_total, 0), 200) / 2)
       + case when p_total <= 0 then 0
              when round(p_acertos * 100.0 / p_total) >= 80 then least(greatest(p_total, 0), 200) / 8
              when round(p_acertos * 100.0 / p_total) >= 70 then least(greatest(p_total, 0), 200) / 16
              else 0 end
$$;

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
    insert into error_notebook (user_id, discipline_id, topic_id, question_answer_id, enunciado, motivo)
      values (v_uid, q.discipline_id, q.topic_id, v_ans, left(coalesce(p_texto, 'Banco de questões'), 20000), case when p_chute then 'chute' end)
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
