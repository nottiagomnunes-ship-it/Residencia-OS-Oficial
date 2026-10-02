-- Mini-checklist próprio de cada revisão (D1, D7, D30...). As etapas do ASSUNTO continuam em topic_tasks e pertencem ao estudo.
create table review_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  review_id uuid not null references reviews on delete cascade,
  tipo text not null default 'outro' check (tipo in ('video','leitura','questoes','flashcards','outro')),
  titulo text not null, qtd_questoes int check (qtd_questoes > 0),
  concluida boolean not null default false, concluida_em timestamptz,
  ordem int not null default 0, created_at timestamptz default now()
);
create index on review_tasks (user_id, review_id);
alter table review_tasks enable row level security;
create policy own on review_tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- "já recebeu o padrão": quem apagar todos os itens de uma revisão não os vê voltarem sozinhos
alter table reviews add column etapas_semeadas boolean not null default false;

-- Cria o padrão (desmarcado) nas revisões PENDENTES informadas que ainda não o receberam. Devolve as revisões que acabou de preencher.
-- A marca "semeada" e a criação acontecem na mesma instrução: duas chamadas ao mesmo tempo não duplicam os itens.
create or replace function semear_revisoes(p_ids uuid[], p_padrao jsonb)
returns setof uuid language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  return query
    with alvo as (
      update reviews set etapas_semeadas = true
        where user_id = v_uid and id = any(p_ids) and etapas_semeadas = false and status = 'pendente' returning id),
    ins as (
      insert into review_tasks (user_id, review_id, tipo, titulo, qtd_questoes, ordem)
        select v_uid, a.id, p.value->>'tipo', p.value->>'titulo', nullif(p.value->>'qtd_questoes', '')::int, (p.n - 1)::int
        from alvo a cross join lateral jsonb_array_elements(p_padrao) with ordinality as p(value, n)
        returning review_id)
    select distinct review_id from ins;
end $$;
