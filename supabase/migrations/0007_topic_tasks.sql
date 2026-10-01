-- etapas (checklist) de cada assunto: videoaula, leitura, questões...
create table topic_tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  topic_id uuid not null references topics on delete cascade,
  tipo text not null default 'outro' check (tipo in ('video','leitura','questoes','flashcards','outro')),
  titulo text not null, qtd_questoes int check (qtd_questoes > 0),
  concluida boolean not null default false, concluida_em timestamptz,
  ordem int not null default 0, created_at timestamptz default now()
);
create index on topic_tasks (user_id, topic_id);
alter table topic_tasks enable row level security;
create policy own on topic_tasks for all using (user_id = auth.uid()) with check (user_id = auth.uid());
