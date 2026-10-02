-- Cronômetro de estudo: um por pessoa, guardado no servidor (continua certo ao navegar, recarregar ou trocar de aparelho).
-- A conta do tempo usa o relógio do servidor, não o do aparelho.
create table cronometros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references profiles on delete cascade,
  item_id uuid references schedule_items on delete set null,            -- a tarefa (se o plano for refeito e ela sumir, o cronômetro continua)
  tipo text not null default 'livre' check (tipo in ('estudo', 'revisao', 'questoes', 'simulado', 'flashcards', 'livre')),
  titulo text not null,
  topic_id uuid references topics on delete set null,
  review_id uuid references reviews on delete set null,
  planejado_min int, qtd_questoes int,
  iniciado_em timestamptz not null default now(),                       -- início do trecho atual (enquanto roda)
  acumulado_seg int not null default 0,                                 -- o que já foi contado antes do trecho atual
  pausado boolean not null default false,
  criado_em timestamptz not null default now()
);
alter table cronometros enable row level security;
create policy own on cronometros for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Inicia. Se já existe um cronômetro, não cria outro e devolve nada.
create or replace function iniciar_cronometro(p_item uuid, p_tipo text, p_titulo text, p_topic uuid, p_review uuid, p_planejado int, p_qtd int)
returns setof cronometros language plpgsql set search_path = public as $$
begin
  return query
    with novo as (
      insert into cronometros (user_id, item_id, tipo, titulo, topic_id, review_id, planejado_min, qtd_questoes)
        values (auth.uid(), p_item, p_tipo, left(p_titulo, 160), p_topic, p_review, p_planejado, p_qtd)
        on conflict (user_id) do nothing returning *)
    select * from novo;
end $$;

-- Pausar e retomar: sempre devolvem o estado atual (repetir não faz mal)
create or replace function pausar_cronometro()
returns setof cronometros language plpgsql set search_path = public as $$
begin
  update cronometros set acumulado_seg = acumulado_seg + greatest(0, floor(extract(epoch from (now() - iniciado_em)))::int), pausado = true
    where user_id = auth.uid() and not pausado;
  return query select * from cronometros where user_id = auth.uid();
end $$;
create or replace function retomar_cronometro()
returns setof cronometros language plpgsql set search_path = public as $$
begin
  update cronometros set iniciado_em = now(), pausado = false where user_id = auth.uid() and pausado;
  return query select * from cronometros where user_id = auth.uid();
end $$;

-- Concluir revisão agora aceita o tempo medido (p_min). A função muda de assinatura, então a antiga sai.
drop function if exists concluir_revisao(uuid, date, int, int, int, text, int, jsonb);
create or replace function concluir_revisao(p_review uuid, p_hoje date, p_desempenho int, p_dificuldade int, p_qtd int, p_obs text, p_xp int, p_ajustes jsonb, p_min int default null)
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
  -- o tempo da revisão entra nas horas estudadas: o medido no cronômetro, se houver; senão o planejado na tarefa (sem tarefa, 30 min)
  v_min := p_min;
  if v_min is null then select coalesce(max(duracao_min), 30) into v_min from schedule_items where user_id = v_uid and review_id = p_review; end if;
  perform registrar_dia(p_hoje, p_xp, v_min, 0, 0);
end $$;
