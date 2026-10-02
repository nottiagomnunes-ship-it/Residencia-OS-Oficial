-- Ajustes pequenos:
-- 1) Registrar questões marca sozinho, na revisão pendente do assunto, o item "Fazer N questões" (e devolve quantas etapas marcou).
-- 2) Concluir uma revisão soma o tempo dela às horas estudadas (e recontamos, uma vez, as revisões já concluídas).

-- 1) a função passa a devolver um número, então precisa ser recriada
drop function if exists registrar_questoes(uuid, uuid, text, text, int, int, int, int, int, date, int);
create or replace function registrar_questoes(p_disc uuid, p_topic uuid, p_banca text, p_prova text, p_ano int, p_total int, p_acertos int,
  p_tempo int, p_dif int, p_dia date, p_xp int)
returns int language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_bloco uuid; v_etapa uuid; v_etapa_rev uuid; v_marcadas int := 0;
begin
  insert into question_sets (user_id, discipline_id, topic_id, banca, prova, ano, total, acertos, tempo_min, dificuldade, realizado_em, xp_ganho)
    values (v_uid, p_disc, p_topic, p_banca, p_prova, p_ano, p_total, p_acertos, p_tempo, p_dif, p_dia, p_xp);
  perform registrar_dia(p_dia, p_xp, coalesce(p_tempo, 0), p_total, p_acertos);
  select id into v_bloco from schedule_items where user_id = v_uid and tipo = 'questoes' and data = p_dia and status <> 'concluido'
    and p_total >= coalesce(qtd_questoes, 0) order by hora_ini nulls last limit 1;
  if v_bloco is not null then update schedule_items set status = 'concluido' where id = v_bloco; end if;
  if p_topic is not null then
    select id into v_etapa from topic_tasks where user_id = v_uid and topic_id = p_topic and tipo = 'questoes' and concluida = false
      and p_total >= coalesce(qtd_questoes, 0) order by ordem limit 1;
    if v_etapa is not null then update topic_tasks set concluida = true, concluida_em = now() where id = v_etapa; v_marcadas := v_marcadas + 1; end if;
    -- etapa da REVISÃO: a revisão mais antiga deste assunto que já venceu (ou venceu hoje) e tem um item de questões com número definido
    -- (como "Fazer 10 questões") que o total registrado atende. Marca um item só; itens sem número ("Refazer as questões que errei") ficam para você.
    select t.id into v_etapa_rev from review_tasks t join reviews r on r.id = t.review_id
      where t.user_id = v_uid and r.user_id = v_uid and r.topic_id = p_topic and r.status = 'pendente' and r.due_date <= p_dia
        and t.tipo = 'questoes' and t.concluida = false and t.qtd_questoes is not null and p_total >= t.qtd_questoes
      order by r.due_date, r.interval_days, t.ordem limit 1;
    if v_etapa_rev is not null then update review_tasks set concluida = true, concluida_em = now() where id = v_etapa_rev; v_marcadas := v_marcadas + 1; end if;
  end if;
  return v_marcadas;
end $$;

-- 2) concluir revisão com tempo
create or replace function concluir_revisao(p_review uuid, p_hoje date, p_desempenho int, p_dificuldade int, p_qtd int, p_obs text, p_xp int, p_ajustes jsonb)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_status text; v_min int; rec record;
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
  -- o tempo da revisão (o planejado na tarefa, que você pode editar; sem tarefa, 30 min) entra nas horas estudadas
  select coalesce(max(duracao_min), 30) into v_min from schedule_items where user_id = v_uid and review_id = p_review;
  perform registrar_dia(p_hoje, p_xp, v_min, 0, 0);
end $$;

-- recontagem única do tempo das revisões já concluídas (a marca em profiles impede que a recontagem se repita se este arquivo rodar de novo)
alter table profiles add column if not exists revisoes_recontadas boolean not null default false;
with soma as (
  select r.user_id, (r.completed_at at time zone 'America/Sao_Paulo')::date as dia,
         sum(coalesce((select max(s.duracao_min) from schedule_items s where s.review_id = r.id), 30)) as minutos
    from reviews r join profiles p on p.id = r.user_id
   where r.status = 'concluida' and r.completed_at is not null and not p.revisoes_recontadas
   group by 1, 2)
insert into daily_stats (user_id, data, minutos) select user_id, dia, minutos from soma
on conflict (user_id, data) do update set minutos = daily_stats.minutos + excluded.minutos;
update profiles set revisoes_recontadas = true where not revisoes_recontadas;
