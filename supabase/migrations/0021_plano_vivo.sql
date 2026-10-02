-- Plano que acompanha a semana: quando o cronograma foi gerado, quando o tempo foi alterado e qual lembrete de semana já foi dispensado;
-- mais a função que move tarefas de dia de uma vez só (reorganizar atrasadas e adiantar).
alter table profiles add column plano_gerado_em timestamptz, add column capacidade_alterada_em timestamptz, add column semana_aviso date;

-- mesma função de antes; ao final registra o momento em que o plano foi gerado
create or replace function aplicar_cronograma(p_hoje date, p_blocos jsonb, p_topicos jsonb)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  delete from schedule_items where user_id = v_uid and origem = 'auto' and tipo in ('estudo', 'questoes', 'simulado')
    and status <> 'concluido' and data >= p_hoje and review_id is null;
  update topics set status = 'nao_iniciado', planned_date = null where user_id = v_uid and planned_auto = true and status = 'planejado';
  insert into schedule_items (user_id, tipo, topic_id, titulo, data, hora_ini, hora_fim, duracao_min, qtd_questoes, ordem_dia, origem)
    select v_uid, b.value->>'tipo', nullif(b.value->>'topic_id', '')::uuid, b.value->>'titulo', (b.value->>'data')::date,
      nullif(b.value->>'hora_ini', '')::time, nullif(b.value->>'hora_fim', '')::time, (b.value->>'duracao_min')::int,
      nullif(b.value->>'qtd_questoes', '')::int, nullif(b.value->>'ordem_dia', '')::int, 'auto'
    from jsonb_array_elements(p_blocos) b;
  update topics t set planned_date = (x.value->>'data')::date, planned_auto = true,
      status = case when t.status = 'nao_iniciado' then 'planejado' else t.status end
    from jsonb_array_elements(p_topicos) x where t.id = (x.value->>'id')::uuid and t.user_id = v_uid;
  update profiles set plano_gerado_em = now() where id = v_uid; -- marca quando o plano foi gerado (para avisar se o tempo mudar depois)
end $$;

-- Move tarefas para outros dias, tudo ou nada. Faz o mesmo que mover uma tarefa à mão: a revisão muda o prazo da revisão,
-- o estudo muda a data planejada do assunto. Ignora o que não é do usuário ou já foi concluído. Devolve quantas moveu.
create or replace function aplicar_movimentos(p_mov jsonb)
returns int language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); n int := 0; m record; i record;
begin
  for m in select (x.value->>'id')::uuid as id, (x.value->>'data')::date as data, nullif(x.value->>'ordem_dia', '')::int as ordem
           from jsonb_array_elements(p_mov) x loop
    select s.id, s.tipo, s.review_id, s.topic_id into i from schedule_items s where s.id = m.id and s.user_id = v_uid and s.status <> 'concluido' for update;
    if not found then continue; end if;
    update schedule_items set data = m.data, status = 'agendado', ordem_dia = coalesce(m.ordem, ordem_dia) where id = m.id;
    if i.review_id is not null then
      update reviews set due_date = m.data where id = i.review_id and user_id = v_uid;
    elsif i.tipo = 'estudo' and i.topic_id is not null then
      update topics set planned_date = m.data, planned_auto = false where id = i.topic_id and user_id = v_uid;
    end if;
    n := n + 1;
  end loop;
  return n;
end $$;
