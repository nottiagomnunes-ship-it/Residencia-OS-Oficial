-- Operações que gravam em várias tabelas passam a ser UMA transação no banco ("tudo ou nada"):
-- se algo falhar no meio (conexão, timeout), nada fica gravado pela metade.
-- As funções rodam com os direitos de quem chama (security invoker): a RLS continua valendo.
-- Rode ESTE arquivo no SQL Editor ANTES de publicar a versão do código que o usa.

-- XP, nível e estatísticas do dia (o nível sobe a cada 500 XP, igual ao código)
create or replace function registrar_dia(p_dia date, p_xp int, p_min int, p_q int, p_ac int)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_xp int;
begin
  update profiles set xp = xp + p_xp where id = v_uid returning xp into v_xp;
  update profiles set level = v_xp / 500 + 1 where id = v_uid;
  insert into daily_stats (user_id, data, minutos, questoes, acertos, xp) values (v_uid, p_dia, p_min, p_q, p_ac, p_xp)
  on conflict (user_id, data) do update set minutos = daily_stats.minutos + excluded.minutos, questoes = daily_stats.questoes + excluded.questoes,
    acertos = daily_stats.acertos + excluded.acertos, xp = daily_stats.xp + excluded.xp;
end $$;

-- Concluir um assunto: sessão, status, revisões (já calculadas pelo app), calendário, XP e estatísticas. Repetir a chamada não duplica nada.
create or replace function concluir_conteudo(p_topic uuid, p_min int, p_hoje date, p_xp int, p_revisoes jsonb)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_nome text; v_status text; v_sessao uuid; v_rev uuid; rec record;
begin
  select nome, status into v_nome, v_status from topics where id = p_topic and user_id = v_uid for update;
  if v_nome is null then raise exception 'assunto não encontrado'; end if;
  if v_status = 'concluido' then return; end if;
  insert into study_sessions (user_id, topic_id, duration_min) values (v_uid, p_topic, p_min) returning id into v_sessao;
  update topics set status = 'concluido', completed_date = p_hoje where id = p_topic;
  update schedule_items set status = 'concluido' where user_id = v_uid and topic_id = p_topic and tipo = 'estudo';
  for rec in select value from jsonb_array_elements(p_revisoes) loop
    insert into reviews (user_id, topic_id, origem_session_id, numero, interval_days, due_date)
      values (v_uid, p_topic, v_sessao, (rec.value->>'numero')::int, (rec.value->>'interval_days')::int, (rec.value->>'due_date')::date) returning id into v_rev;
    insert into schedule_items (user_id, tipo, topic_id, review_id, titulo, data, duracao_min)
      values (v_uid, 'revisao', p_topic, v_rev, 'Revisão D' || (rec.value->>'interval_days') || ' — ' || v_nome, (rec.value->>'due_date')::date, 30);
  end loop;
  perform registrar_dia(p_hoje, p_xp, p_min, 0, 0);
end $$;

-- Concluir uma revisão: resultado, calendário, reajuste das próximas revisões (p_ajustes = [{id, due_date}]) e XP.
create or replace function concluir_revisao(p_review uuid, p_hoje date, p_desempenho int, p_dificuldade int, p_qtd int, p_obs text, p_xp int, p_ajustes jsonb)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_status text; rec record;
begin
  select status into v_status from reviews where id = p_review and user_id = v_uid for update;
  if v_status is null then raise exception 'revisão não encontrada'; end if;
  if v_status = 'concluida' then return; end if;
  update reviews set status = 'concluida', completed_at = now(), desempenho = p_desempenho, dificuldade = p_dificuldade, questoes_qtd = p_qtd, observacoes = p_obs where id = p_review;
  update schedule_items set status = 'concluido' where user_id = v_uid and review_id = p_review;
  for rec in select value from jsonb_array_elements(coalesce(p_ajustes, '[]'::jsonb)) loop
    update reviews set due_date = (rec.value->>'due_date')::date where id = (rec.value->>'id')::uuid and user_id = v_uid;
    update schedule_items set data = (rec.value->>'due_date')::date where review_id = (rec.value->>'id')::uuid and user_id = v_uid;
  end loop;
  perform registrar_dia(p_hoje, p_xp, 0, 0, 0);
end $$;

-- Gerar cronograma: troca o plano automático antigo pelo novo de uma vez. Nunca toca em revisões, concluídos nem itens manuais.
create or replace function aplicar_cronograma(p_hoje date, p_blocos jsonb, p_topicos jsonb)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  delete from schedule_items where user_id = v_uid and origem = 'auto' and tipo in ('estudo', 'questoes', 'simulado')
    and status <> 'concluido' and data >= p_hoje and review_id is null;
  update topics set status = 'nao_iniciado', planned_date = null where user_id = v_uid and planned_auto = true and status = 'planejado';
  insert into schedule_items (user_id, tipo, topic_id, titulo, data, hora_ini, hora_fim, duracao_min, qtd_questoes, origem)
    select v_uid, b.value->>'tipo', nullif(b.value->>'topic_id', '')::uuid, b.value->>'titulo', (b.value->>'data')::date,
      nullif(b.value->>'hora_ini', '')::time, nullif(b.value->>'hora_fim', '')::time, (b.value->>'duracao_min')::int, nullif(b.value->>'qtd_questoes', '')::int, 'auto'
    from jsonb_array_elements(p_blocos) b;
  update topics t set planned_date = (x.value->>'data')::date, planned_auto = true,
      status = case when t.status = 'nao_iniciado' then 'planejado' else t.status end
    from jsonb_array_elements(p_topicos) x where t.id = (x.value->>'id')::uuid and t.user_id = v_uid;
end $$;

-- Registrar questões: a sessão, as estatísticas do dia, o bloco planejado do dia e a etapa de questões do assunto.
create or replace function registrar_questoes(p_disc uuid, p_topic uuid, p_banca text, p_prova text, p_ano int, p_total int, p_acertos int,
  p_tempo int, p_dif int, p_dia date, p_xp int)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_bloco uuid; v_etapa uuid;
begin
  insert into question_sets (user_id, discipline_id, topic_id, banca, prova, ano, total, acertos, tempo_min, dificuldade, realizado_em)
    values (v_uid, p_disc, p_topic, p_banca, p_prova, p_ano, p_total, p_acertos, p_tempo, p_dif, p_dia);
  perform registrar_dia(p_dia, p_xp, 0, p_total, p_acertos);
  select id into v_bloco from schedule_items where user_id = v_uid and tipo = 'questoes' and data = p_dia and status <> 'concluido'
    and p_total >= coalesce(qtd_questoes, 0) order by hora_ini nulls last limit 1;
  if v_bloco is not null then update schedule_items set status = 'concluido' where id = v_bloco; end if;
  if p_topic is not null then
    select id into v_etapa from topic_tasks where user_id = v_uid and topic_id = p_topic and tipo = 'questoes' and concluida = false
      and p_total >= coalesce(qtd_questoes, 0) order by ordem limit 1;
    if v_etapa is not null then update topic_tasks set concluida = true, concluida_em = now() where id = v_etapa; end if;
  end if;
end $$;
