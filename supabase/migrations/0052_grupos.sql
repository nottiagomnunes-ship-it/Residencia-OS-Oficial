-- Grupos de estudo (opcional): a pessoa cria um grupo ou entra com um código e vê um ranking semanal só com quem está no grupo.
-- Ninguém vê o plano, os assuntos ou as questões dos outros: só o apelido e três números da semana (% do plano cumprido, questões e dias de estudo).
-- Seguro para rodar de novo.

create table if not exists grupos (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (char_length(nome) between 1 and 40),
  codigo text not null unique,
  criado_por uuid not null references profiles on delete cascade,
  criado_em timestamptz not null default now()
);
create table if not exists grupo_membros (
  grupo_id uuid not null references grupos on delete cascade,
  user_id uuid not null references profiles on delete cascade,
  apelido text not null check (char_length(apelido) between 1 and 30),
  entrou_em timestamptz not null default now(),
  primary key (grupo_id, user_id)
);
create index if not exists grupo_membros_user on grupo_membros (user_id);
alter table grupos enable row level security;
alter table grupo_membros enable row level security;

-- quem é do grupo (sem recursão nas regras de acesso)
create or replace function sou_membro(p_grupo uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from grupo_membros where grupo_id = p_grupo and user_id = auth.uid())
$$;

drop policy if exists membros_veem on grupos;
create policy membros_veem on grupos for select using (sou_membro(id));
drop policy if exists membros_veem on grupo_membros;
create policy membros_veem on grupo_membros for select using (sou_membro(grupo_id));
drop policy if exists muda_o_proprio_apelido on grupo_membros;
create policy muda_o_proprio_apelido on grupo_membros for update using (user_id = auth.uid()) with check (user_id = auth.uid());
-- entrar, criar e sair só pelas funções abaixo

create or replace function criar_grupo(p_nome text, p_apelido text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid; v_cod text; letras constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  if (select count(*) from grupo_membros where user_id = v_uid) >= 10 then return jsonb_build_object('erro', 'limite'); end if;
  loop
    v_cod := (select string_agg(substr(letras, 1 + floor(random() * length(letras))::int, 1), '') from generate_series(1, 6));
    exit when not exists (select 1 from grupos where codigo = v_cod);
  end loop;
  insert into grupos (nome, codigo, criado_por) values (left(btrim(p_nome), 40), v_cod, v_uid) returning id into v_id;
  insert into grupo_membros (grupo_id, user_id, apelido) values (v_id, v_uid, left(btrim(p_apelido), 30));
  return jsonb_build_object('id', v_id, 'codigo', v_cod);
end $$;

create or replace function entrar_no_grupo(p_codigo text, p_apelido text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  select id into v_id from grupos where codigo = upper(btrim(p_codigo));
  if v_id is null then return jsonb_build_object('erro', 'codigo'); end if;
  if exists (select 1 from grupo_membros where grupo_id = v_id and user_id = v_uid) then return jsonb_build_object('id', v_id, 'ja', true); end if;
  if (select count(*) from grupo_membros where user_id = v_uid) >= 10 then return jsonb_build_object('erro', 'limite'); end if;
  if (select count(*) from grupo_membros where grupo_id = v_id) >= 50 then return jsonb_build_object('erro', 'cheio'); end if;
  insert into grupo_membros (grupo_id, user_id, apelido) values (v_id, v_uid, left(btrim(p_apelido), 30));
  return jsonb_build_object('id', v_id);
end $$;

create or replace function sair_do_grupo(p_grupo uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  delete from grupo_membros where grupo_id = p_grupo and user_id = v_uid;
  delete from grupos g where g.id = p_grupo and not exists (select 1 from grupo_membros m where m.grupo_id = g.id); -- o último a sair apaga o grupo
end $$;

-- Ranking da semana (de p_ini, segunda-feira, até p_hoje). Só para quem é do grupo. Por pessoa:
--   feito     = minutos das tarefas concluídas com data na semana até hoje
--   planejado = feito + minutos das tarefas em aberto de dias da semana que já passaram (hoje ainda não conta contra)
--   questoes  = questões registradas na semana; dias = dias com estudo ou questões
create or replace function ranking_do_grupo(p_grupo uuid, p_ini date, p_hoje date)
returns table (apelido text, eu boolean, planejado int, feito int, questoes int, dias int)
language plpgsql stable security definer set search_path = public as $$
begin
  if not sou_membro(p_grupo) then raise exception 'Você não está neste grupo'; end if;
  if p_hoje < p_ini or p_hoje > p_ini + 6 then raise exception 'Semana inválida'; end if;
  return query
    select m.apelido, m.user_id = auth.uid(),
      (coalesce((select sum(coalesce(s.duracao_min, 30)) from schedule_items s where s.user_id = m.user_id and s.data between p_ini and p_hoje
          and (s.status = 'concluido' or s.data < p_hoje)), 0))::int,
      (coalesce((select sum(coalesce(s.duracao_min, 30)) from schedule_items s where s.user_id = m.user_id and s.data between p_ini and p_hoje
          and s.status = 'concluido'), 0))::int,
      (coalesce((select sum(d.questoes) from daily_stats d where d.user_id = m.user_id and d.data between p_ini and p_hoje), 0))::int,
      (select count(*) from daily_stats d where d.user_id = m.user_id and d.data between p_ini and p_hoje and (d.minutos > 0 or d.questoes > 0))::int
    from grupo_membros m where m.grupo_id = p_grupo;
end $$;

revoke execute on function ranking_do_grupo(uuid, date, date) from anon;
revoke execute on function criar_grupo(text, text) from anon;
revoke execute on function entrar_no_grupo(text, text) from anon;
revoke execute on function sair_do_grupo(uuid) from anon;
