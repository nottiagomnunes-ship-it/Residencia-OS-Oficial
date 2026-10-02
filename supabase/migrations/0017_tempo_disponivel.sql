-- Planejamento por TEMPO DISPONÍVEL (sem horários de relógio): quantos minutos de estudo a pessoa tem em cada dia,
-- e a ordem das tarefas dentro do dia. Os horários e compromissos antigos deixam de ser usados (os dados continuam no banco).
create table capacidade_dia (
  user_id uuid not null references profiles on delete cascade,
  data date not null,
  minutos int not null check (minutos between 0 and 960),
  primary key (user_id, data)
);
alter table capacidade_dia enable row level security;
create policy own on capacidade_dia for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table schedule_items add column ordem_dia int;

-- mesma função de antes, agora gravando também a ordem das tarefas no dia
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
end $$;
