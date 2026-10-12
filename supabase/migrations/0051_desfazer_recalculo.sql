-- Desfazer o "Recalcular rota": antes de aplicar, o app guarda uma cópia do plano em aberto (uma por pessoa; o próximo recálculo a substitui).
-- Desfazer devolve tarefas, datas planejadas dos assuntos e prazos das revisões ao que eram, por até 7 dias e só enquanto nenhuma tarefa
-- automática de estudo/questões/simulado tiver sido concluída depois do recálculo. Tarefas criadas à mão e concluídas nunca são tocadas.
-- Seguro para rodar de novo.

create table if not exists plano_versoes (
  user_id uuid primary key references profiles on delete cascade,
  criado_em timestamptz not null default now(),
  modo text not null,
  itens jsonb not null,          -- tarefas em aberto (linhas inteiras de schedule_items)
  concluidos uuid[] not null,    -- ids das tarefas já concluídas naquele momento
  topicos jsonb not null,        -- assuntos não concluídos: id, planned_date, planned_auto, status
  revisoes jsonb not null        -- revisões pendentes: id, due_date
);
alter table plano_versoes enable row level security;
drop policy if exists own on plano_versoes;
create policy own on plano_versoes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function salvar_versao_plano(p_modo text)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  insert into plano_versoes (user_id, criado_em, modo, itens, concluidos, topicos, revisoes) values (v_uid, now(), p_modo,
    coalesce((select jsonb_agg(to_jsonb(s)) from schedule_items s where s.user_id = v_uid and s.status <> 'concluido'), '[]'::jsonb),
    coalesce(array(select s.id from schedule_items s where s.user_id = v_uid and s.status = 'concluido'), '{}'::uuid[]),
    coalesce((select jsonb_agg(jsonb_build_object('id', t.id, 'planned_date', t.planned_date, 'planned_auto', t.planned_auto, 'status', t.status))
      from topics t where t.user_id = v_uid and t.status <> 'concluido'), '[]'::jsonb),
    coalesce((select jsonb_agg(jsonb_build_object('id', r.id, 'due_date', r.due_date)) from reviews r where r.user_id = v_uid and r.status = 'pendente'), '[]'::jsonb))
  on conflict (user_id) do update set criado_em = excluded.criado_em, modo = excluded.modo, itens = excluded.itens,
    concluidos = excluded.concluidos, topicos = excluded.topicos, revisoes = excluded.revisoes;
end $$;

-- Devolve 'ok', 'sem_versao', 'expirou' ou 'concluiu' (alguma tarefa do plano foi feita depois do recálculo). Tudo ou nada.
create or replace function desfazer_recalculo()
returns text language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v plano_versoes%rowtype; ids uuid[];
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  select * into v from plano_versoes where user_id = v_uid for update;
  if not found then return 'sem_versao'; end if;
  if v.criado_em < now() - interval '7 days' then delete from plano_versoes where user_id = v_uid; return 'expirou'; end if;
  if exists (select 1 from schedule_items s where s.user_id = v_uid and s.status = 'concluido' and s.origem = 'auto'
               and s.tipo in ('estudo', 'questoes', 'simulado') and not (s.id = any(v.concluidos))) then return 'concluiu'; end if;
  ids := array(select (e.x->>'id')::uuid from jsonb_array_elements(v.itens) as e(x));

  -- 1) tira o que o recálculo criou (automático, em aberto, que não existia antes)
  delete from schedule_items s where s.user_id = v_uid and s.origem = 'auto' and s.status <> 'concluido' and s.review_id is null
    and not (s.id = any(ids)) and not (s.id = any(v.concluidos));
  -- 2) recria o que o recálculo apagou (se o assunto/revisão ainda existir e o assunto não tiver sido concluído)
  insert into schedule_items
    select (jsonb_populate_record(null::schedule_items, e.x)).* from jsonb_array_elements(v.itens) as e(x)
     where (e.x->>'user_id')::uuid = v_uid
       and not exists (select 1 from schedule_items s where s.id = (e.x->>'id')::uuid)
       and (e.x->>'topic_id' is null or exists (select 1 from topics t where t.id = (e.x->>'topic_id')::uuid and t.user_id = v_uid and t.status <> 'concluido'))
       and (e.x->>'review_id' is null or exists (select 1 from reviews r where r.id = (e.x->>'review_id')::uuid and r.user_id = v_uid));
  -- 3) devolve data, ordem e situação do que foi movido
  update schedule_items s set data = (e.x->>'data')::date, ordem_dia = nullif(e.x->>'ordem_dia', '')::int, status = e.x->>'status'
    from jsonb_array_elements(v.itens) as e(x) where s.id = (e.x->>'id')::uuid and s.user_id = v_uid and s.status <> 'concluido';
  update topics t set planned_date = (e.x->>'planned_date')::date, planned_auto = (e.x->>'planned_auto')::boolean, status = e.x->>'status'
    from jsonb_array_elements(v.topicos) as e(x) where t.id = (e.x->>'id')::uuid and t.user_id = v_uid and t.status <> 'concluido';
  update reviews r set due_date = (e.x->>'due_date')::date
    from jsonb_array_elements(v.revisoes) as e(x) where r.id = (e.x->>'id')::uuid and r.user_id = v_uid and r.status = 'pendente';
  delete from plano_versoes where user_id = v_uid;
  return 'ok';
end $$;
