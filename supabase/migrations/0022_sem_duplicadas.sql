-- Corrige a duplicação de estudos atrasados ao "Atualizar cronograma": o assunto era replanejado para a frente, mas a tarefa atrasada
-- antiga ficava, e o mesmo assunto aparecia duas vezes. Agora a antiga é removida junto com a atualização.
-- Também limpa, uma vez, as duplicatas que já existem. Seguro para rodar de novo.

-- 1) limpeza das duplicatas atuais: remove a cópia ATRASADA de um estudo automático quando o mesmo assunto já tem outra cópia futura em aberto
delete from schedule_items s
 where s.origem = 'auto' and s.tipo = 'estudo' and s.status <> 'concluido' and s.review_id is null and s.topic_id is not null
   and s.data < (now() at time zone 'America/Sao_Paulo')::date
   and exists (select 1 from schedule_items f where f.user_id = s.user_id and f.topic_id = s.topic_id and f.id <> s.id
                 and f.origem = 'auto' and f.tipo = 'estudo' and f.status <> 'concluido' and f.review_id is null
                 and f.data >= (now() at time zone 'America/Sao_Paulo')::date);

-- 2) a função que atualiza o cronograma, agora sem criar a duplicata
create or replace function aplicar_cronograma(p_hoje date, p_blocos jsonb, p_topicos jsonb)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  delete from schedule_items where user_id = v_uid and origem = 'auto' and tipo in ('estudo', 'questoes', 'simulado')
    and status <> 'concluido' and data >= p_hoje and review_id is null;
  -- Um estudo que ficou ATRASADO e cujo assunto está sendo replanejado agora sairia duplicado (a tarefa antiga mais a nova). Remove a antiga.
  -- Só atinge tarefas automáticas de estudo, ainda não feitas, de assuntos que ganharam novo bloco nesta atualização.
  delete from schedule_items where user_id = v_uid and origem = 'auto' and tipo = 'estudo' and status <> 'concluido' and data < p_hoje and review_id is null
    and topic_id in (select (x.value->>'id')::uuid from jsonb_array_elements(p_topicos) x);
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
