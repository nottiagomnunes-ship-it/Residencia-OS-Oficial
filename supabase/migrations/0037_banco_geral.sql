-- Banco geral: questões que a conta administradora publica para TODAS as contas.
-- Só vão o enunciado (com figuras), as alternativas, o gabarito (a letra) e a classificação; o COMENTÁRIO nunca vai (não existe coluna para ele).
-- Cada conta recebe uma cópia no próprio banco (com o próprio histórico, assunto e disciplina); correções do gabarito/enunciado chegam às cópias.
-- Pode ser executada mais de uma vez. Depois, para virar administrador, rode (trocando o e-mail):
--   insert into admins (uid) select id from auth.users where email = 'seu@email.com' on conflict do nothing;

-- Quem administra. A coluna NÃO se chama user_id de propósito (o "Apagar tudo" apaga toda tabela com user_id).
create table if not exists admins (uid uuid primary key references auth.users on delete cascade);
alter table admins enable row level security; -- sem políticas: ninguém lê ou muda pela API; só pelo SQL Editor

create or replace function eh_admin() returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from admins where uid = auth.uid())
$$;

-- Nome sem acento e minúsculo, para ligar disciplina e assunto pelo nome ("Anestesiologia" = "anestesiologia").
create or replace function nome_normal(t text) returns text language sql immutable as $$
  select nullif(regexp_replace(lower(translate(coalesce(t, ''), 'ÁÀÂÃÄáàâãäÉÈÊËéèêëÍÌÎÏíìîïÓÒÔÕÖóòôõöÚÙÛÜúùûüÇçÑñ', 'AAAAAaaaaaEEEEeeeeIIIIiiiiOOOOOoooooUUUUuuuuCcNn')), '[^a-z0-9]+', ' ', 'g'), '')
$$;

create table if not exists banco_geral (
  id uuid primary key default gen_random_uuid(),
  hash text not null unique,
  blocos jsonb not null,
  alternativas jsonb not null,
  gabarito text check (gabarito in ('A', 'B', 'C', 'D', 'E')),
  gabarito_origem text check (gabarito_origem in ('oficial', 'ia')),
  anulada boolean not null default false,
  area text check (area in ('clinica', 'cirurgia', 'pediatria', 'go', 'preventiva')),
  disciplina text, assunto text,          -- por NOME: cada conta liga às suas disciplinas e assuntos
  banca text, ano int, colecao text,
  publicada_por uuid references auth.users on delete set null,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now()
);
create index if not exists banco_geral_atualizada on banco_geral (atualizada_em);
alter table banco_geral enable row level security;
drop policy if exists "banco geral: todos leem" on banco_geral;
drop policy if exists "banco geral: admin muda" on banco_geral;
create policy "banco geral: todos leem" on banco_geral for select to authenticated using (true);
create policy "banco geral: admin muda" on banco_geral for all to authenticated using (eh_admin()) with check (eh_admin());

-- A cópia de cada conta sabe de qual questão geral veio.
alter table banco_questoes add column if not exists origem_geral uuid references banco_geral on delete set null;
alter table banco_questoes add column if not exists sincronizada_em timestamptz;
create unique index if not exists banco_questoes_origem_geral on banco_questoes (user_id, origem_geral) where origem_geral is not null;
alter table profiles add column if not exists banco_geral_em timestamptz; -- até quando o banco geral já foi trazido para esta conta

-- Questões gerais que a pessoa excluiu do próprio banco: não voltam sozinhas.
create table if not exists banco_geral_removidas (
  user_id uuid not null references profiles on delete cascade,
  geral_id uuid not null references banco_geral on delete cascade,
  primary key (user_id, geral_id)
);
alter table banco_geral_removidas enable row level security;
drop policy if exists own on banco_geral_removidas;
create policy own on banco_geral_removidas for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function lembrar_removida_do_geral() returns trigger language plpgsql set search_path = public as $$
begin
  if old.origem_geral is not null and coalesce(current_setting('app.apagando_tudo', true), '') <> '1' then
    insert into banco_geral_removidas (user_id, geral_id) values (old.user_id, old.origem_geral) on conflict do nothing;
  end if;
  return old;
end $$;
drop trigger if exists lembrar_removida_do_geral on banco_questoes;
create trigger lembrar_removida_do_geral after delete on banco_questoes for each row execute function lembrar_removida_do_geral();

-- Figuras do banco geral: pasta "geral/" do bucket provas. Todos leem; só o administrador envia, troca ou apaga.
drop policy if exists "provas: ver as figuras do banco geral" on storage.objects;
drop policy if exists "provas: admin envia figuras do banco geral" on storage.objects;
drop policy if exists "provas: admin apaga figuras do banco geral" on storage.objects;
create policy "provas: ver as figuras do banco geral" on storage.objects for select to authenticated
  using (bucket_id = 'provas' and (storage.foldername(name))[1] = 'geral');
create policy "provas: admin envia figuras do banco geral" on storage.objects for insert to authenticated
  with check (bucket_id = 'provas' and (storage.foldername(name))[1] = 'geral' and eh_admin());
create policy "provas: admin apaga figuras do banco geral" on storage.objects for delete to authenticated
  using (bucket_id = 'provas' and (storage.foldername(name))[1] = 'geral' and eh_admin());

-- Traz o banco geral para a conta: liga as questões iguais que a pessoa já tinha, aplica as correções e copia as novas
-- (menos as que ela excluiu). Rápida quando não há nada novo. Devolve quantas entraram e quantas foram corrigidas.
create or replace function sincronizar_banco_geral()
returns jsonb language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_max timestamptz; v_ult timestamptz; n_novas int := 0; n_corr int := 0;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  select max(atualizada_em) into v_max from banco_geral;
  select banco_geral_em into v_ult from profiles where id = v_uid;
  if v_max is null or (v_ult is not null and v_ult >= v_max) then return jsonb_build_object('novas', 0, 'corrigidas', 0); end if;

  -- a mesma questão que a pessoa já tinha (importou o mesmo arquivo): passa a ser a cópia da geral, sem duplicar
  update banco_questoes b set origem_geral = g.id, sincronizada_em = null
    from banco_geral g
   where b.user_id = v_uid and b.origem_geral is null and b.hash = g.hash
     and not exists (select 1 from banco_questoes o where o.user_id = v_uid and o.origem_geral = g.id);

  -- correções: enunciado, alternativas, gabarito, anulada, banca e ano. Assunto, disciplina, comentário e histórico da pessoa ficam.
  update banco_questoes b set blocos = g.blocos, alternativas = g.alternativas, gabarito = g.gabarito, gabarito_origem = g.gabarito_origem,
         anulada = g.anulada, banca = coalesce(g.banca, b.banca), ano = coalesce(g.ano, b.ano), sincronizada_em = now(),
         hash = case when b.hash = g.hash or exists (select 1 from banco_questoes o where o.user_id = v_uid and o.hash = g.hash) then b.hash else g.hash end
    from banco_geral g
   where b.user_id = v_uid and b.origem_geral = g.id and g.atualizada_em > coalesce(b.sincronizada_em, '-infinity'::timestamptz)
     and (b.blocos, b.alternativas, b.gabarito, b.gabarito_origem, b.anulada) is distinct from (g.blocos, g.alternativas, g.gabarito, g.gabarito_origem, g.anulada);
  get diagnostics n_corr = row_count;
  update banco_questoes b set sincronizada_em = now() from banco_geral g
   where b.user_id = v_uid and b.origem_geral = g.id and b.sincronizada_em is null;

  -- novas: disciplina e assunto ligados pelo nome aos da pessoa (se ela tiver); senão ficam a área e o nome do assunto
  insert into banco_questoes (user_id, hash, blocos, alternativas, gabarito, gabarito_origem, anulada, area, discipline_id, topic_id, assunto, banca, ano, fonte, origem_geral, sincronizada_em)
    select v_uid, g.hash, g.blocos, g.alternativas, g.gabarito, g.gabarito_origem, g.anulada, g.area, d.id, t.id, g.assunto, g.banca, g.ano,
           'Banco geral' || coalesce(' · ' || g.colecao, ''), g.id, now()
      from banco_geral g
      left join lateral (select id from disciplines where user_id = v_uid and nome_normal(nome) = nome_normal(g.disciplina) order by ordem limit 1) d on true
      left join lateral (select id from topics where user_id = v_uid and discipline_id = d.id and nome_normal(nome) = nome_normal(g.assunto) limit 1) t on true
     where not exists (select 1 from banco_questoes b where b.user_id = v_uid and b.origem_geral = g.id)
       and not exists (select 1 from banco_geral_removidas r where r.user_id = v_uid and r.geral_id = g.id)
    on conflict do nothing;
  get diagnostics n_novas = row_count;

  update profiles set banco_geral_em = v_max where id = v_uid;
  return jsonb_build_object('novas', n_novas, 'corrigidas', n_corr);
end $$;

-- Administrador: publica questões do PRÓPRIO banco no banco geral (ou atualiza as já publicadas). Sem o comentário.
-- p_itens: [{ id, blocos }] — blocos com as figuras já copiadas para "geral/". Tudo ou nada. Devolve quantas novas e quantas atualizadas.
create or replace function publicar_no_banco_geral(p_itens jsonb, p_colecao text)
returns jsonb language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); i jsonb; b record; v_id uuid; v_nova boolean; n_novas int := 0; n_atual int := 0;
begin
  if not eh_admin() then raise exception 'Só a conta administradora publica no banco geral'; end if;
  if jsonb_array_length(p_itens) > 1000 then raise exception 'No máximo 1000 questões por vez'; end if;
  for i in select * from jsonb_array_elements(p_itens) loop
    select q.*, d.nome as disc_nome into b from banco_questoes q left join disciplines d on d.id = q.discipline_id
     where q.id = (i ->> 'id')::uuid and q.user_id = v_uid;
    if not found then continue; end if;
    v_id := b.origem_geral;
    if v_id is not null and exists (select 1 from banco_geral where id = v_id) then
      update banco_geral set blocos = coalesce(i -> 'blocos', b.blocos), alternativas = b.alternativas, gabarito = b.gabarito, gabarito_origem = b.gabarito_origem,
             anulada = b.anulada, area = b.area, disciplina = b.disc_nome, assunto = b.assunto, banca = b.banca, ano = b.ano,
             colecao = coalesce(nullif(trim(p_colecao), ''), colecao), atualizada_em = now(),
             hash = case when exists (select 1 from banco_geral o where o.hash = b.hash and o.id <> v_id) then hash else b.hash end
       where id = v_id;
      n_atual := n_atual + 1;
    else
      insert into banco_geral (hash, blocos, alternativas, gabarito, gabarito_origem, anulada, area, disciplina, assunto, banca, ano, colecao, publicada_por)
        values (b.hash, coalesce(i -> 'blocos', b.blocos), b.alternativas, b.gabarito, b.gabarito_origem, b.anulada, b.area, b.disc_nome, b.assunto, b.banca, b.ano,
                nullif(trim(p_colecao), ''), v_uid)
        on conflict (hash) do update set blocos = excluded.blocos, alternativas = excluded.alternativas, gabarito = excluded.gabarito,
             gabarito_origem = excluded.gabarito_origem, anulada = excluded.anulada, area = excluded.area, disciplina = excluded.disciplina,
             assunto = excluded.assunto, banca = excluded.banca, ano = excluded.ano, colecao = coalesce(excluded.colecao, banco_geral.colecao), atualizada_em = now()
        returning id, (xmax = 0) into v_id, v_nova; -- xmax = 0: a linha foi inserida (não atualizada)
      if v_nova then n_novas := n_novas + 1; else n_atual := n_atual + 1; end if;
      update banco_questoes set origem_geral = v_id, sincronizada_em = now() where id = b.id;
    end if;
  end loop;
  return jsonb_build_object('novas', n_novas, 'atualizadas', n_atual);
end $$;

-- Administrador: tira questões do banco geral. As cópias que as contas já têm continuam no banco delas (como questões próprias).
create or replace function retirar_do_banco_geral(p_ids uuid[])
returns int language plpgsql set search_path = public as $$
declare n int;
begin
  if not eh_admin() then raise exception 'Só a conta administradora mexe no banco geral'; end if;
  delete from banco_geral where id in (select origem_geral from banco_questoes where id = any(p_ids) and user_id = auth.uid() and origem_geral is not null);
  get diagnostics n = row_count;
  return n;
end $$;

-- "Apagar tudo" (0036) com uma linha a mais: as questões do banco geral voltam depois de apagar.
create or replace function apagar_tudo()
returns jsonb language plpgsql set search_path = public as $$
declare
  v_uid uuid := auth.uid(); t text; n int; restam int; passada int := 0; v_total int := 0; sets text;
  tabelas text[];
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  perform set_config('app.apagando_tudo', '1', true); -- as questões do banco geral apagadas aqui NÃO contam como "removidas pela pessoa": voltam na próxima sincronização
  select array_agg(c.table_name::text order by c.table_name) into tabelas
    from information_schema.columns c join information_schema.tables tb on tb.table_schema = c.table_schema and tb.table_name = c.table_name
   where c.table_schema = 'public' and c.column_name = 'user_id' and tb.table_type = 'BASE TABLE' and c.table_name <> 'profiles';
  loop
    passada := passada + 1; restam := 0;
    foreach t in array tabelas loop
      begin
        execute format('delete from %I where user_id = $1', t) using v_uid;
        get diagnostics n = row_count; v_total := v_total + n;
      exception when foreign_key_violation then restam := restam + 1; -- outra tabela ainda aponta para esta: tenta de novo na próxima passada
      end;
    end loop;
    exit when restam = 0;
    if passada >= 10 then raise exception 'Não foi possível apagar tudo (ligações entre tabelas). Nada foi apagado.'; end if;
  end loop;

  -- perfil: todos os campos voltam ao valor padrão (os sem padrão e obrigatórios ficam como estão); o nome sai; o assistente e o tutorial voltam
  select string_agg(format('%I = default', column_name), ', ') into sets
    from information_schema.columns
   where table_schema = 'public' and table_name = 'profiles' and column_name not in ('id', 'created_at')
     and (column_default is not null or is_nullable = 'YES') and is_generated = 'NEVER';
  execute format('update profiles set %s where id = $1', sets) using v_uid;
  update profiles set study_start_date = current_date where id = v_uid;
  return jsonb_build_object('apagados', v_total);
end $$;
