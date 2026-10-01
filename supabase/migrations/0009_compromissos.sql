-- horários ocupados (internato, plantões, aulas...) e a janela diária em que o estudo pode acontecer
create table commitments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  titulo text not null,
  tipo text not null default 'semanal' check (tipo in ('semanal','pontual')),
  dias int[] not null default '{}',            -- 0 = domingo ... 6 = sábado (semanal)
  data date,                                    -- dia único (pontual)
  hora_ini time not null, hora_fim time not null, -- fim <= início = vira a noite (ex.: 19:00–07:00)
  valido_de date, valido_ate date,
  created_at timestamptz default now()
);
create index on commitments (user_id);
alter table commitments enable row level security;
create policy own on commitments for all using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table profiles
  add column janela_ini time not null default '06:00',
  add column janela_fim time not null default '23:00',
  add column folga_min int not null default 30 check (folga_min between 0 and 180);
