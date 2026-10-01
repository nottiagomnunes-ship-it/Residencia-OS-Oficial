-- Residência OS · schema inicial. Todas as tabelas isoladas por user_id via RLS.
create table profiles (
  id uuid primary key references auth.users on delete cascade,
  nome text, onboarded boolean not null default false,
  exam_date date, study_start_date date default current_date,
  daily_minutes int default 240, available_weekdays int[] default '{1,2,3,4,5,6}',
  daily_questions_goal int default 40, review_intervals int[] default '{1,7,30,60}',
  xp int not null default 0, level int not null default 1, created_at timestamptz default now()
);
create table disciplines (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  nome text not null, cor text default '#22C55E', peso int not null default 3 check (peso between 1 and 5), ordem int default 0
);
create table topics (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  discipline_id uuid not null references disciplines on delete cascade,
  subcategoria text, nome text not null,
  prioridade int default 2 check (prioridade between 1 and 3), dificuldade int default 2 check (dificuldade between 1 and 3),
  status text not null default 'nao_iniciado' check (status in ('nao_iniciado','planejado','em_andamento','concluido')),
  planned_date date, completed_date date
);
create table study_sessions (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  topic_id uuid references topics on delete set null, started_at timestamptz default now(),
  duration_min int not null default 0, tipo text default 'estudo', notas text
);
create table reviews (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  topic_id uuid not null references topics on delete cascade, origem_session_id uuid references study_sessions on delete set null,
  numero int not null, interval_days int not null, due_date date not null,
  status text not null default 'pendente' check (status in ('pendente','concluida','adiada')),
  completed_at timestamptz, desempenho int, dificuldade int, questoes_qtd int, observacoes text
);
create table question_sets (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  discipline_id uuid references disciplines on delete set null, topic_id uuid references topics on delete set null,
  banca text, prova text, ano int, total int not null check (total > 0), acertos int not null check (acertos >= 0),
  erros int generated always as (total - acertos) stored, tempo_min int, dificuldade int,
  realizado_em date not null default current_date, check (acertos <= total)
);
create table question_answers (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  question_set_id uuid not null references question_sets on delete cascade, correta boolean not null, tempo_s int, ref_questao text
);
create table error_notebook (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  discipline_id uuid references disciplines on delete set null, topic_id uuid references topics on delete set null,
  question_answer_id uuid references question_answers on delete set null, enunciado text,
  motivo text not null check (motivo in ('falta_conteudo','falta_atencao','confusao_conceitos','erro_interpretacao','chute')),
  comentario text, revisar_em date, revisado boolean not null default false, created_at timestamptz default now()
);
create table schedule_items (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  tipo text not null check (tipo in ('estudo','revisao','questoes','flashcards','simulado')),
  topic_id uuid references topics on delete cascade, review_id uuid references reviews on delete cascade,
  titulo text not null, data date not null, hora_ini time, hora_fim time, duracao_min int, qtd_questoes int,
  status text not null default 'agendado' check (status in ('agendado','proximo','concluido','atrasado','adiado')),
  origem text not null default 'auto' check (origem in ('auto','manual'))
);
create table mock_exams (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  nome text not null, data date not null, total int, acertos int, tempo_min int, por_disciplina jsonb
);
create table goals (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  periodo text not null check (periodo in ('dia','semana','mes')), metrica text not null, alvo int not null, inicio date, fim date
);
create table achievements (
  id uuid primary key default gen_random_uuid(), user_id uuid not null references profiles on delete cascade,
  codigo text not null, desbloqueada_em timestamptz default now(), unique (user_id, codigo)
);
create table daily_stats (
  user_id uuid not null references profiles on delete cascade, data date not null,
  minutos int default 0, questoes int default 0, acertos int default 0, xp int default 0, primary key (user_id, data)
);

create index on reviews (user_id, due_date, status);
create index on schedule_items (user_id, data);
create index on question_sets (user_id, topic_id);
create index on topics (user_id, discipline_id);

-- RLS: cada usuário só acessa as próprias linhas
alter table profiles enable row level security;
create policy own_profile on profiles for all using (id = auth.uid()) with check (id = auth.uid());
do $$ declare t text; begin
  foreach t in array array['disciplines','topics','study_sessions','reviews','question_sets','question_answers',
    'error_notebook','schedule_items','mock_exams','goals','achievements','daily_stats'] loop
    execute format('alter table %I enable row level security', t);
    execute format('create policy own on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- cria o perfil automaticamente no cadastro
create function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin insert into profiles (id) values (new.id); return new; end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
