-- padrões de etapas do usuário (lista de opções para adicionar com um clique) e o "conjunto padrão" aplicado de uma vez
create table etapa_modelos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  tipo text not null default 'outro' check (tipo in ('video','leitura','questoes','flashcards','outro')),
  titulo text not null, qtd_questoes int check (qtd_questoes > 0),
  conjunto boolean not null default false,
  ordem int not null default 0, created_at timestamptz default now()
);
create index on etapa_modelos (user_id);
alter table etapa_modelos enable row level security;
create policy own on etapa_modelos for all using (user_id = auth.uid()) with check (user_id = auth.uid());
-- os padrões iniciais são criados uma única vez por usuário (assim ele pode apagar ou editar todos)
alter table profiles add column modelos_semeados boolean not null default false;
