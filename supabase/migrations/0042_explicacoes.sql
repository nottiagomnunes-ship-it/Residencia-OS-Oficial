-- Explicações das questões: texto ORIGINAL (escrito por IA ou pela administradora), num campo separado do "comentário".
-- O comentário (que pode ser de cursinho) continua sem ir para o banco geral; a explicação vai, marcada pela origem:
-- 'ia' (gerada por IA, conferir) ou 'revisada' (a administradora conferiu/editou). Quem estuda pode reportar erro numa explicação.
-- Pode ser executada mais de uma vez (depois da 0040).

alter table banco_questoes add column if not exists explicacao text;
alter table banco_questoes add column if not exists explicacao_origem text check (explicacao_origem in ('ia', 'revisada'));
alter table banco_geral add column if not exists explicacao text;
alter table banco_geral add column if not exists explicacao_origem text check (explicacao_origem in ('ia', 'revisada'));

-- Reportes de erro: quem reportou vê os seus; a administradora vê todos e marca como resolvidos.
create table if not exists explicacao_reportes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  hash text not null,                                   -- a questão (pela impressão digital: é a mesma em todas as contas)
  geral_id uuid references banco_geral on delete set null,
  motivo text not null check (length(motivo) between 3 and 1000),
  criado_em timestamptz not null default now(),
  resolvido_em timestamptz
);
create index if not exists explicacao_reportes_abertos on explicacao_reportes (resolvido_em, criado_em);
alter table explicacao_reportes enable row level security;
drop policy if exists "reportes: quem reportou" on explicacao_reportes;
drop policy if exists "reportes: admin vê" on explicacao_reportes;
drop policy if exists "reportes: admin resolve" on explicacao_reportes;
create policy "reportes: quem reportou" on explicacao_reportes for all using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reportes: admin vê" on explicacao_reportes for select to authenticated using (eh_admin());
create policy "reportes: admin resolve" on explicacao_reportes for update to authenticated using (eh_admin()) with check (eh_admin());

-- Publicar leva a explicação; sincronizar traz a explicação (e as correções dela) para as cópias.
create or replace function publicar_no_banco_geral(p_itens jsonb, p_colecao text)
returns jsonb language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); i jsonb; b record; v_id uuid; v_nova boolean; n_novas int := 0; n_atual int := 0;
begin
  if not eh_admin() then raise exception 'Só a conta administradora publica no banco geral'; end if;
  if jsonb_array_length(p_itens) > 1000 then raise exception 'No máximo 1000 questões por vez'; end if;
  for i in select * from jsonb_array_elements(p_itens) loop
    select q.*, coalesce(te.especialidade, d.nome) as disc_nome, coalesce(te.area, q.area) as area_final, coalesce(te.nome, q.assunto) as assunto_final
      into b from banco_questoes q left join disciplines d on d.id = q.discipline_id left join temas te on te.id = q.tema_id
     where q.id = (i ->> 'id')::uuid and q.user_id = v_uid;
    if not found then continue; end if;
    v_id := b.origem_geral;
    if v_id is not null and exists (select 1 from banco_geral where id = v_id) then
      update banco_geral set blocos = coalesce(i -> 'blocos', b.blocos), alternativas = b.alternativas, gabarito = b.gabarito, gabarito_origem = b.gabarito_origem,
             anulada = b.anulada, area = b.area_final, disciplina = b.disc_nome, assunto = b.assunto_final, banca = b.banca, ano = b.ano, tema_id = b.tema_id, explicacao = b.explicacao, explicacao_origem = b.explicacao_origem,
             colecao = coalesce(nullif(trim(p_colecao), ''), colecao), atualizada_em = now(),
             hash = case when exists (select 1 from banco_geral o where o.hash = b.hash and o.id <> v_id) then hash else b.hash end
       where id = v_id;
      n_atual := n_atual + 1;
    else
      insert into banco_geral (hash, blocos, alternativas, gabarito, gabarito_origem, anulada, area, disciplina, assunto, banca, ano, colecao, publicada_por, tema_id, explicacao, explicacao_origem)
        values (b.hash, coalesce(i -> 'blocos', b.blocos), b.alternativas, b.gabarito, b.gabarito_origem, b.anulada, b.area_final, b.disc_nome, b.assunto_final, b.banca, b.ano,
                nullif(trim(p_colecao), ''), v_uid, b.tema_id, b.explicacao, b.explicacao_origem)
        on conflict (hash) do update set blocos = excluded.blocos, alternativas = excluded.alternativas, gabarito = excluded.gabarito,
             gabarito_origem = excluded.gabarito_origem, anulada = excluded.anulada, area = excluded.area, disciplina = excluded.disciplina,
             assunto = excluded.assunto, banca = excluded.banca, ano = excluded.ano, colecao = coalesce(excluded.colecao, banco_geral.colecao), tema_id = excluded.tema_id, explicacao = excluded.explicacao, explicacao_origem = excluded.explicacao_origem, atualizada_em = now()
        returning id, (xmax = 0) into v_id, v_nova; -- xmax = 0: a linha foi inserida (não atualizada)
      if v_nova then n_novas := n_novas + 1; else n_atual := n_atual + 1; end if;
      update banco_questoes set origem_geral = v_id, sincronizada_em = now() where id = b.id;
    end if;
  end loop;
  return jsonb_build_object('novas', n_novas, 'atualizadas', n_atual);
end $$;

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

  -- correções: enunciado, alternativas, gabarito, anulada, banca, ano e o TEMA (com o assunto e a ligação pelo nome, se o tema mudou).
  -- Comentário e histórico da pessoa ficam.
  update banco_questoes b set blocos = g.blocos, alternativas = g.alternativas, gabarito = g.gabarito, gabarito_origem = g.gabarito_origem,
         anulada = g.anulada, banca = coalesce(g.banca, b.banca), ano = coalesce(g.ano, b.ano), sincronizada_em = now(),
         tema_id = g.tema_id, explicacao = g.explicacao, explicacao_origem = g.explicacao_origem,
         assunto = case when g.tema_id is distinct from b.tema_id then coalesce(g.assunto, b.assunto) else b.assunto end,
         area = case when g.tema_id is distinct from b.tema_id then coalesce(g.area, b.area) else b.area end,
         discipline_id = case when g.tema_id is distinct from b.tema_id then coalesce(
           (select id from disciplines where user_id = v_uid and nome_normal(nome) = nome_normal(g.disciplina) order by ordem limit 1), b.discipline_id) else b.discipline_id end,
         topic_id = case when g.tema_id is distinct from b.tema_id then
           (select t.id from topics t join disciplines d on d.id = t.discipline_id where t.user_id = v_uid and nome_normal(d.nome) = nome_normal(g.disciplina)
               and nome_normal(t.nome) = nome_normal(g.assunto) limit 1) else b.topic_id end,
         hash = case when b.hash = g.hash or exists (select 1 from banco_questoes o where o.user_id = v_uid and o.hash = g.hash) then b.hash else g.hash end
    from banco_geral g
   where b.user_id = v_uid and b.origem_geral = g.id and g.atualizada_em > coalesce(b.sincronizada_em, '-infinity'::timestamptz)
     and (b.blocos, b.alternativas, b.gabarito, b.gabarito_origem, b.anulada, b.tema_id, b.explicacao) is distinct from (g.blocos, g.alternativas, g.gabarito, g.gabarito_origem, g.anulada, g.tema_id, g.explicacao);
  get diagnostics n_corr = row_count;
  update banco_questoes b set sincronizada_em = now() from banco_geral g
   where b.user_id = v_uid and b.origem_geral = g.id and b.sincronizada_em is null;

  -- novas: disciplina e assunto ligados pelo nome aos da pessoa (se ela tiver); senão ficam a área e o nome do assunto
  insert into banco_questoes (user_id, hash, blocos, alternativas, gabarito, gabarito_origem, anulada, area, discipline_id, topic_id, assunto, banca, ano, fonte, origem_geral, sincronizada_em, tema_id, explicacao, explicacao_origem)
    select v_uid, g.hash, g.blocos, g.alternativas, g.gabarito, g.gabarito_origem, g.anulada, g.area, d.id, t.id, g.assunto, g.banca, g.ano,
           'Banco geral' || coalesce(' · ' || g.colecao, ''), g.id, now(), g.tema_id, g.explicacao, g.explicacao_origem
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
