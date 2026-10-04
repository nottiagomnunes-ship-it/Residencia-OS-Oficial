-- Banco de questões: questões avulsas (importadas de PDF, .docx ou de um pacote .json), classificadas por área/disciplina/assunto,
-- para montar listas e fazê-las na mesma tela das provas. Os erros vão para o Caderno de Erros e o resultado para o Desempenho do assunto.
-- Pode ser executada mais de uma vez.

create table if not exists banco_questoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  hash text not null,                                                   -- impressão digital do texto (evita a mesma questão duas vezes)
  blocos jsonb not null,
  alternativas jsonb not null,
  gabarito text check (gabarito in ('A', 'B', 'C', 'D', 'E')),
  gabarito_origem text check (gabarito_origem in ('oficial', 'ia')),  -- "ia" = sugerido, conferir
  anulada boolean not null default false,
  comentario text,
  area text check (area in ('clinica', 'cirurgia', 'pediatria', 'go', 'preventiva')),
  discipline_id uuid references disciplines on delete set null,
  topic_id uuid references topics on delete set null,
  assunto text,                                                         -- o nome do assunto, mesmo quando ele não existe em Conteúdos
  banca text, ano int, fonte text,                                      -- fonte = arquivo ou lote de onde veio
  criada_em timestamptz not null default now(),
  vezes int not null default 0, acertos int not null default 0,        -- quantas vezes fez e acertou
  ultima_em timestamptz, ultimo_certo boolean,
  unique (user_id, hash)
);
create index if not exists banco_questoes_filtros on banco_questoes (user_id, discipline_id, topic_id);
alter table banco_questoes enable row level security;
drop policy if exists own on banco_questoes;
create policy own on banco_questoes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Uma lista montada do banco é uma "prova" do tipo lista: usa a mesma tela de fazer, salvar e corrigir.
alter table provas add column if not exists tipo text not null default 'prova' check (tipo in ('prova', 'lista'));
alter table prova_questoes add column if not exists banco_questao_id uuid references banco_questoes on delete set null;

-- Importar: grava o que é novo e ignora o que já existe (mesmo hash). Devolve quantas entraram.
create or replace function importar_banco(p_itens jsonb)
returns int language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); n int;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  insert into banco_questoes (user_id, hash, blocos, alternativas, gabarito, gabarito_origem, anulada, comentario, area, discipline_id, topic_id, assunto, banca, ano, fonte)
    select v_uid, i ->> 'hash', i -> 'blocos', i -> 'alternativas', nullif(i ->> 'gabarito', ''), nullif(i ->> 'gabarito_origem', ''),
           coalesce((i ->> 'anulada')::boolean, false), nullif(i ->> 'comentario', ''), nullif(i ->> 'area', ''),
           nullif(i ->> 'discipline_id', '')::uuid, nullif(i ->> 'topic_id', '')::uuid, nullif(i ->> 'assunto', ''),
           nullif(i ->> 'banca', ''), nullif(i ->> 'ano', '')::int, nullif(i ->> 'fonte', '')
      from jsonb_array_elements(p_itens) i
    on conflict (user_id, hash) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

-- Montar uma lista com as questões escolhidas (na ordem dada) e já abrir a tentativa. Tudo ou nada.
create or replace function montar_lista(p_nome text, p_ids uuid[])
returns uuid language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_prova uuid; v_tent uuid; n int;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  if coalesce(array_length(p_ids, 1), 0) = 0 or array_length(p_ids, 1) > 200 then raise exception 'Escolha de 1 a 200 questões'; end if;
  insert into provas (user_id, nome, tipo) values (v_uid, left(p_nome, 120), 'lista') returning id into v_prova;
  insert into prova_questoes (user_id, prova_id, numero, blocos, alternativas, gabarito, anulada, area, discipline_id, topic_id, banco_questao_id)
    select v_uid, v_prova, x.ord::int, b.blocos, b.alternativas, b.gabarito, b.anulada, b.area, b.discipline_id, b.topic_id, b.id
      from unnest(p_ids) with ordinality as x(id, ord) join banco_questoes b on b.id = x.id and b.user_id = v_uid;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'Nenhuma questão encontrada'; end if;
  insert into prova_tentativas (user_id, prova_id) values (v_uid, v_prova) returning id into v_tent;
  return v_tent;
end $$;

-- Corrigir uma lista: como a prova, mas o resultado vai para as QUESTÕES (Desempenho por disciplina e assunto), não para Simulados.
-- O app manda total, acertos e XP (mesma regra de "Registrar questões"); aqui a conta é refeita e, se não bater, nada é gravado.
create or replace function corrigir_lista(p_tentativa uuid, p_dia date, p_xp int, p_total int, p_acertos int, p_textos jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_uid uuid := auth.uid(); t record; p record; r record; g record;
  v_total int; v_acertos int; v_min int; v_set uuid; v_ans uuid; v_err uuid; v_cad int := 0; v_bloco uuid;
begin
  select * into t from prova_tentativas where id = p_tentativa and user_id = v_uid for update;
  if not found then raise exception 'Tentativa não encontrada'; end if;
  select * into p from provas where id = t.prova_id;
  if p.tipo <> 'lista' then raise exception 'Não é uma lista'; end if;
  if t.status = 'corrigida' then return jsonb_build_object('ja_corrigida', true); end if;
  if exists (select 1 from prova_questoes where prova_id = t.prova_id and not anulada and gabarito is null) then raise exception 'Falta o gabarito de alguma questão'; end if;

  insert into prova_respostas (user_id, tentativa_id, questao_id) select v_uid, t.id, q.id from prova_questoes q where q.prova_id = t.prova_id
    on conflict (tentativa_id, questao_id) do nothing;
  update prova_respostas x set correta = case when q.anulada then null else coalesce(x.alternativa = q.gabarito, false) end
    from prova_questoes q where q.id = x.questao_id and x.tentativa_id = t.id;
  select count(*) filter (where not q.anulada), count(*) filter (where x.correta) into v_total, v_acertos
    from prova_respostas x join prova_questoes q on q.id = x.questao_id where x.tentativa_id = t.id;
  if v_total < 1 then raise exception 'Todas as questões estão anuladas'; end if;
  if v_total <> p_total or v_acertos <> p_acertos then raise exception 'A correção mudou enquanto era gravada. Recarregue a página e tente de novo.'; end if;
  v_min := ceil(t.tempo_seg / 60.0)::int;

  -- uma sessão de questões por disciplina/assunto (é o que alimenta o Desempenho); o tempo vai inteiro na primeira
  for g in select q.discipline_id, q.topic_id, count(*) as total, count(*) filter (where x.correta) as acertos
             from prova_respostas x join prova_questoes q on q.id = x.questao_id
            where x.tentativa_id = t.id and not q.anulada group by q.discipline_id, q.topic_id order by count(*) desc loop
    insert into question_sets (user_id, discipline_id, topic_id, banca, prova, total, acertos, tempo_min, realizado_em, xp_ganho)
      values (v_uid, g.discipline_id, g.topic_id, 'Banco de questões', left(p.nome, 120), g.total, g.acertos, case when v_set is null then nullif(v_min, 0) end, p_dia,
              case when v_set is null then p_xp else 0 end)
      returning id into v_set;
    for r in select x.id, x.chute, x.correta, q.numero, q.discipline_id, q.topic_id, q.banco_questao_id
               from prova_respostas x join prova_questoes q on q.id = x.questao_id
              where x.tentativa_id = t.id and not q.anulada and q.discipline_id is not distinct from g.discipline_id and q.topic_id is not distinct from g.topic_id
              order by q.numero loop
      insert into question_answers (user_id, question_set_id, correta, ref_questao) values (v_uid, v_set, r.correta, left(p.nome, 100) || ' · Q' || r.numero)
        returning id into v_ans;
      if not r.correta or r.chute then
        insert into error_notebook (user_id, discipline_id, topic_id, question_answer_id, enunciado, motivo)
          values (v_uid, r.discipline_id, r.topic_id, v_ans, coalesce(p_textos ->> (select questao_id::text from prova_respostas where id = r.id), left(p.nome, 100) || ' · Questão ' || r.numero),
                  case when r.chute then 'chute' end)
          returning id into v_err;
        update prova_respostas set erro_id = v_err where id = r.id;
        v_cad := v_cad + 1;
      end if;
      if r.banco_questao_id is not null then
        update banco_questoes set vezes = vezes + 1, acertos = acertos + (case when r.correta then 1 else 0 end), ultima_em = now(), ultimo_certo = r.correta
         where id = r.banco_questao_id and user_id = v_uid;
      end if;
    end loop;
  end loop;

  perform registrar_dia(p_dia, p_xp, v_min, v_total, v_acertos);
  select id into v_bloco from schedule_items where user_id = v_uid and tipo = 'questoes' and data = p_dia and status <> 'concluido'
    and v_total >= coalesce(qtd_questoes, 0) order by hora_ini nulls last limit 1;
  if v_bloco is not null then update schedule_items set status = 'concluido' where id = v_bloco; end if;
  update prova_tentativas set status = 'corrigida', corrigida_em = now(), entregue_em = coalesce(entregue_em, now()), total = v_total, acertos = v_acertos
   where id = t.id;
  return jsonb_build_object('total', v_total, 'acertos', v_acertos, 'caderno', v_cad);
end $$;
