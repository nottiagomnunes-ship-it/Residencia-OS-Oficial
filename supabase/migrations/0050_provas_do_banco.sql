-- Provas cadastradas no banco geral: a administração diz que um conjunto de questões É uma prova (nome, banca, ano, total de questões)
-- e liga cada questão ao seu número nela. A página Provas lista só as provas cadastradas (não adivinha mais por banca + ano), mostra se
-- estão completas e não mistura duas provas da mesma banca e ano (ex.: acesso direto e R+). Questões avulsas continuam sem prova.
-- A mesma questão pode estar numa prova e nas listas por tema, sem duplicar. Pode ser executada mais de uma vez (depois da 0049).

create table if not exists provas_geral (
  id uuid primary key default gen_random_uuid(),
  nome text not null check (length(trim(nome)) between 2 and 120),
  banca text not null check (length(banca) between 1 and 60),
  ano int not null check (ano between 1990 and 2100),
  total int not null check (total between 1 and 300),          -- quantas questões a prova tem (para dizer se está completa)
  publicada_por uuid references auth.users on delete set null,  -- (não se chama user_id: o "Apagar tudo" não pode apagar provas do banco geral)
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  unique (banca, ano, nome)
);
create table if not exists prova_geral_questoes (
  prova_id uuid not null references provas_geral on delete cascade,
  geral_id uuid not null references banco_geral on delete cascade,
  numero int not null check (numero between 1 and 300),
  primary key (prova_id, numero),
  unique (prova_id, geral_id)
);
create index if not exists prova_geral_questoes_geral on prova_geral_questoes (geral_id);
alter table provas_geral enable row level security;
alter table prova_geral_questoes enable row level security;
drop policy if exists "provas geral: todos leem" on provas_geral;
drop policy if exists "provas geral: admin muda" on provas_geral;
drop policy if exists "provas geral questoes: todos leem" on prova_geral_questoes;
drop policy if exists "provas geral questoes: admin muda" on prova_geral_questoes;
create policy "provas geral: todos leem" on provas_geral for select to authenticated using (true);
create policy "provas geral: admin muda" on provas_geral for all to authenticated using (eh_admin()) with check (eh_admin());
create policy "provas geral questoes: todos leem" on prova_geral_questoes for select to authenticated using (true);
create policy "provas geral questoes: admin muda" on prova_geral_questoes for all to authenticated using (eh_admin()) with check (eh_admin());

-- a prova da conta (a que a pessoa fez) lembra de qual prova do banco veio
alter table provas add column if not exists prova_geral uuid references provas_geral on delete set null;

-- Cadastrar (ou completar) uma prova com questões JÁ publicadas: p_itens = [{"id": <questão do banco da administradora>, "numero": n}].
-- A prova é achada por banca + ano + nome (cadastrar de novo completa a mesma). Número já ocupado por outra questão: a nova fica no lugar.
create or replace function cadastrar_prova_geral(p_prova jsonb, p_itens jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare v_id uuid; n int := 0; sem int := 0; i jsonb; v_geral uuid; v_num int;
begin
  if not eh_admin() then raise exception 'Só a administração cadastra provas' using errcode = '42501'; end if;
  insert into provas_geral (nome, banca, ano, total, publicada_por)
    values (trim(p_prova ->> 'nome'), trim(p_prova ->> 'banca'), (p_prova ->> 'ano')::int, (p_prova ->> 'total')::int, auth.uid())
    on conflict (banca, ano, nome) do update set total = excluded.total, atualizada_em = now()
    returning id into v_id;
  for i in select * from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) loop
    v_num := nullif(i ->> 'numero', '')::int;
    select origem_geral into v_geral from banco_questoes where id = (i ->> 'id')::uuid and user_id = auth.uid();
    if v_geral is null or v_num is null or v_num < 1 or v_num > 300 then sem := sem + 1; continue; end if;
    delete from prova_geral_questoes where prova_id = v_id and (numero = v_num or geral_id = v_geral);
    insert into prova_geral_questoes (prova_id, geral_id, numero) values (v_id, v_geral, v_num);
    n := n + 1;
  end loop;
  update provas_geral set atualizada_em = now() where id = v_id;
  return jsonb_build_object('id', v_id, 'ligadas', n, 'sem_ligacao', sem);
end $$;

-- Cadastrar uma prova com o que já está no banco geral: as questões da banca e do ano (e da coleção, se escolhida) que têm número.
create or replace function cadastrar_prova_existente(p_nome text, p_banca text, p_ano int, p_total int, p_colecao text)
returns jsonb language plpgsql set search_path = public as $$
declare v_id uuid; n int;
begin
  if not eh_admin() then raise exception 'Só a administração cadastra provas' using errcode = '42501'; end if;
  insert into provas_geral (nome, banca, ano, total, publicada_por) values (trim(p_nome), trim(p_banca), p_ano, p_total, auth.uid())
    on conflict (banca, ano, nome) do update set total = excluded.total, atualizada_em = now()
    returning id into v_id;
  insert into prova_geral_questoes (prova_id, geral_id, numero)
    select distinct on (g.numero) v_id, g.id, g.numero from banco_geral g
     where g.banca = p_banca and g.ano = p_ano and g.numero between 1 and 300
       and (nullif(trim(p_colecao), '') is null or g.colecao = p_colecao)
     order by g.numero, g.atualizada_em desc
    on conflict do nothing;
  get diagnostics n = row_count;
  return jsonb_build_object('id', v_id, 'ligadas', n);
end $$;

-- Fazer uma prova do banco: as questões dela que estão no banco da pessoa (com gabarito ou anuladas), com o número da prova, como PROVA
-- (cronômetro, resultado em Simulados). Tentativa em andamento: continua. Mesmas questões de uma feita antes: refaz nela. Senão, cria outra.
drop function if exists montar_prova_completa(text, int);
create or replace function montar_prova_do_banco(p_prova uuid)
returns uuid language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); pg record; v_prova uuid; v_tent uuid; n int;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  select * into pg from provas_geral where id = p_prova;
  if not found then raise exception 'Prova não encontrada'; end if;
  select t.id into v_tent from prova_tentativas t join provas p on p.id = t.prova_id
   where p.user_id = v_uid and p.prova_geral = p_prova and t.status <> 'corrigida' order by t.iniciada_em desc limit 1;
  if v_tent is not null then return v_tent; end if;

  create temp table if not exists _qs (banco_id uuid, numero int) on commit drop;
  delete from _qs;
  insert into _qs select distinct on (l.numero) b.id, l.numero
    from prova_geral_questoes l join banco_questoes b on b.origem_geral = l.geral_id and b.user_id = v_uid
   where l.prova_id = p_prova and (b.gabarito is not null or b.anulada)
   order by l.numero, b.criada_em;
  select count(*) into n from _qs;
  if n = 0 then raise exception 'Nenhuma questão dessa prova no seu banco'; end if;

  select p.id into v_prova from provas p where p.user_id = v_uid and p.prova_geral = p_prova
     and (select coalesce(array_agg(q.banco_questao_id order by q.banco_questao_id), '{}') from prova_questoes q where q.prova_id = p.id)
       = (select coalesce(array_agg(banco_id order by banco_id), '{}') from _qs)
   order by p.criada_em desc limit 1;
  if v_prova is null then
    insert into provas (user_id, nome, banca, ano, tipo, do_banco, prova_geral) values (v_uid, pg.nome, pg.banca, pg.ano, 'prova', true, p_prova) returning id into v_prova;
    insert into prova_questoes (user_id, prova_id, numero, blocos, alternativas, gabarito, anulada, area, discipline_id, topic_id, banco_questao_id)
      select v_uid, v_prova, x.numero, b.blocos, b.alternativas, b.gabarito, b.anulada, coalesce(te.area, b.area), b.discipline_id, b.topic_id, b.id
        from _qs x join banco_questoes b on b.id = x.banco_id left join temas te on te.id = b.tema_id;
  end if;
  insert into prova_tentativas (user_id, prova_id) values (v_uid, v_prova) returning id into v_tent;
  return v_tent;
end $$;
