-- Provas dentro do app: importar uma prova (.docx), fazer no app com cronômetro, corrigir pelo gabarito e mandar os erros para o caderno.
-- Pode ser executada mais de uma vez sem erro (tudo usa "if not exists" / "or replace" / "drop ... if exists").

-- 1) A prova e as questões. O enunciado fica em "blocos" (texto e figuras, na ordem); as alternativas em [{letra, texto}].
create table if not exists provas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  nome text not null check (char_length(nome) between 1 and 120),
  banca text, ano int,
  criada_em timestamptz not null default now()
);
create table if not exists prova_questoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  prova_id uuid not null references provas on delete cascade,
  numero int not null,
  blocos jsonb not null,
  alternativas jsonb not null,
  gabarito text check (gabarito in ('A', 'B', 'C', 'D', 'E')),
  anulada boolean not null default false,
  area text check (area in ('clinica', 'cirurgia', 'pediatria', 'go', 'preventiva')),
  discipline_id uuid references disciplines on delete set null,      -- escolhida na correção (só para as que você errou)
  topic_id uuid references topics on delete set null,
  unique (prova_id, numero)
);

-- 2) Cada vez que você faz a prova. Só uma tentativa aberta por prova; dá para parar e continuar (até em outro aparelho).
create table if not exists prova_tentativas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  prova_id uuid not null references provas on delete cascade,
  status text not null default 'em_andamento' check (status in ('em_andamento', 'entregue', 'corrigida')),
  iniciada_em timestamptz not null default now(),
  entregue_em timestamptz, corrigida_em timestamptz,
  tempo_seg int not null default 0 check (tempo_seg >= 0),           -- só o tempo com a prova aberta na tela
  atual int not null default 1,                                       -- número da questão em que você parou
  total int, acertos int,
  mock_exam_id uuid references mock_exams on delete set null          -- o resultado registrado em Simulados
);
create unique index if not exists prova_tentativas_uma_aberta on prova_tentativas (prova_id) where status <> 'corrigida';
create index if not exists prova_tentativas_user on prova_tentativas (user_id, prova_id);

create table if not exists prova_respostas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles on delete cascade,
  tentativa_id uuid not null references prova_tentativas on delete cascade,
  questao_id uuid not null references prova_questoes on delete cascade,
  alternativa text check (alternativa in ('A', 'B', 'C', 'D', 'E')),
  chute boolean not null default false,
  marcada boolean not null default false,                             -- "voltar depois"
  riscadas text not null default '' check (riscadas ~ '^[A-E]{0,5}$'),
  correta boolean,                                                    -- preenchida na correção (null = anulada)
  erro_id uuid references error_notebook on delete set null,          -- a anotação criada no caderno de erros
  atualizada_em timestamptz not null default now(),
  unique (tentativa_id, questao_id)
);
create index if not exists prova_questoes_prova on prova_questoes (prova_id, numero);
create index if not exists prova_respostas_erro on prova_respostas (erro_id);

do $$ declare t text; begin
  foreach t in array array['provas', 'prova_questoes', 'prova_tentativas', 'prova_respostas'] loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists own on %I', t);
    execute format('create policy own on %I for all using (user_id = auth.uid()) with check (user_id = auth.uid())', t);
  end loop;
end $$;

-- 3) Os erros da prova entram no caderno antes de você dizer o motivo: o motivo passa a ser opcional ("a definir").
alter table error_notebook alter column motivo drop not null;

-- 4) Figuras das provas: pasta privada por pessoa (<seu id>/<id da prova>/arquivo). Só imagens, até 5 MB cada.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('provas', 'provas', false, 5242880, array['image/png', 'image/jpeg', 'image/gif', 'image/webp'])
  on conflict (id) do nothing;
drop policy if exists "provas: ver as proprias figuras" on storage.objects;
drop policy if exists "provas: enviar figuras na propria pasta" on storage.objects;
drop policy if exists "provas: apagar as proprias figuras" on storage.objects;
create policy "provas: ver as proprias figuras" on storage.objects for select to authenticated
  using (bucket_id = 'provas' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "provas: enviar figuras na propria pasta" on storage.objects for insert to authenticated
  with check (bucket_id = 'provas' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "provas: apagar as proprias figuras" on storage.objects for delete to authenticated
  using (bucket_id = 'provas' and (storage.foldername(name))[1] = auth.uid()::text);

-- 5) Gravar a prova importada: a prova e todas as questões, tudo ou nada.
create or replace function salvar_prova(p_prova jsonb, p_questoes jsonb)
returns uuid language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid := (p_prova ->> 'id')::uuid;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  insert into provas (id, user_id, nome, banca, ano) values (v_id, v_uid, p_prova ->> 'nome', nullif(p_prova ->> 'banca', ''), (p_prova ->> 'ano')::int);
  insert into prova_questoes (user_id, prova_id, numero, blocos, alternativas, gabarito, anulada, area)
    select v_uid, v_id, (q ->> 'numero')::int, q -> 'blocos', q -> 'alternativas', nullif(q ->> 'gabarito', ''), coalesce((q ->> 'anulada')::boolean, false), nullif(q ->> 'area', '')
      from jsonb_array_elements(p_questoes) q;
  return v_id;
end $$;

-- 6) Ajustar várias questões de uma vez (gabarito, anulada, área). Só mexe nos campos que vierem em cada item.
create or replace function atualizar_questoes_da_prova(p_prova uuid, p_itens jsonb)
returns int language plpgsql set search_path = public as $$
declare n int;
begin
  update prova_questoes q set
      gabarito = case when i ? 'gabarito' then nullif(i ->> 'gabarito', '') else q.gabarito end,
      anulada = case when i ? 'anulada' then coalesce((i ->> 'anulada')::boolean, false) else q.anulada end,
      area = case when i ? 'area' then nullif(i ->> 'area', '') else q.area end
    from jsonb_array_elements(p_itens) i
   where q.prova_id = p_prova and q.user_id = auth.uid() and q.numero = (i ->> 'numero')::int;
  get diagnostics n = row_count;
  return n;
end $$;

-- 7) Começar (ou continuar) a prova: devolve a tentativa aberta, criando uma se não houver.
create or replace function iniciar_tentativa(p_prova uuid)
returns uuid language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if not exists (select 1 from provas where id = p_prova and user_id = v_uid) then raise exception 'Prova não encontrada'; end if;
  insert into prova_tentativas (user_id, prova_id) values (v_uid, p_prova) on conflict (prova_id) where status <> 'corrigida' do nothing;
  select id into v_id from prova_tentativas where prova_id = p_prova and user_id = v_uid and status <> 'corrigida';
  return v_id;
end $$;

-- 8) Gravar uma resposta (e o tempo de prova). Sem questão (p_questao nulo) grava só o tempo e onde você parou.
-- Depois de entregue, nada muda: devolve o status para o app avisar.
create or replace function responder_questao(p_tentativa uuid, p_questao uuid, p_alt text, p_chute boolean, p_marcada boolean, p_riscadas text, p_tempo int, p_atual int)
returns text language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); t record;
begin
  select * into t from prova_tentativas where id = p_tentativa and user_id = v_uid;
  if not found then raise exception 'Tentativa não encontrada'; end if;
  if t.status <> 'em_andamento' then return t.status; end if;
  if p_questao is not null then
    if not exists (select 1 from prova_questoes where id = p_questao and prova_id = t.prova_id) then raise exception 'Questão de outra prova'; end if;
    insert into prova_respostas (user_id, tentativa_id, questao_id, alternativa, chute, marcada, riscadas)
      values (v_uid, p_tentativa, p_questao, nullif(p_alt, ''), coalesce(p_chute, false), coalesce(p_marcada, false), coalesce(p_riscadas, ''))
      on conflict (tentativa_id, questao_id) do update set alternativa = excluded.alternativa, chute = excluded.chute, marcada = excluded.marcada,
        riscadas = excluded.riscadas, atualizada_em = now();
  end if;
  update prova_tentativas set tempo_seg = greatest(tempo_seg, least(coalesce(p_tempo, 0), 86400)), atual = coalesce(p_atual, atual) where id = p_tentativa;
  return 'ok';
end $$;

-- 9) Entregar: a partir daqui as respostas não mudam mais.
create or replace function entregar_tentativa(p_tentativa uuid, p_tempo int)
returns void language plpgsql set search_path = public as $$
begin
  update prova_tentativas set status = 'entregue', entregue_em = now(), tempo_seg = greatest(tempo_seg, least(coalesce(p_tempo, 0), 86400))
   where id = p_tentativa and user_id = auth.uid() and status = 'em_andamento';
end $$;

-- 10) Corrigir, tudo ou nada: compara com o gabarito, registra o resultado em Simulados (com o acerto por área), as questões no Desempenho,
-- o XP e o tempo do dia, e manda para o caderno de erros o que você errou, deixou em branco ou acertou no chute.
-- O app calcula o total, os acertos e o XP (mesma regra dos simulados) e manda o texto de cada questão; aqui a conta é refeita e, se não bater
-- (o gabarito mudou no meio do caminho, por exemplo), nada é gravado.
create or replace function corrigir_tentativa(p_tentativa uuid, p_dia date, p_xp int, p_total int, p_acertos int, p_textos jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_uid uuid := auth.uid(); t record; p record; r record;
  v_total int; v_acertos int; v_min int; v_mock uuid; v_set uuid; v_ans uuid; v_err uuid; v_area jsonb; v_cad int := 0;
begin
  select * into t from prova_tentativas where id = p_tentativa and user_id = v_uid for update;
  if not found then raise exception 'Tentativa não encontrada'; end if;
  if t.status = 'corrigida' then return jsonb_build_object('ja_corrigida', true); end if;
  select * into p from provas where id = t.prova_id;
  if exists (select 1 from prova_questoes where prova_id = t.prova_id and not anulada and gabarito is null) then raise exception 'Falta o gabarito de alguma questão'; end if;

  -- uma linha por questão (as deixadas em branco também) e a correção de cada uma
  insert into prova_respostas (user_id, tentativa_id, questao_id) select v_uid, t.id, q.id from prova_questoes q where q.prova_id = t.prova_id
    on conflict (tentativa_id, questao_id) do nothing;
  update prova_respostas x set correta = case when q.anulada then null else coalesce(x.alternativa = q.gabarito, false) end
    from prova_questoes q where q.id = x.questao_id and x.tentativa_id = t.id;
  select count(*) filter (where not q.anulada), count(*) filter (where x.correta) into v_total, v_acertos
    from prova_respostas x join prova_questoes q on q.id = x.questao_id where x.tentativa_id = t.id;
  if v_total < 1 then raise exception 'Todas as questões estão anuladas'; end if;
  if v_total <> p_total or v_acertos <> p_acertos then raise exception 'A correção mudou enquanto era gravada. Recarregue a página e tente de novo.'; end if;
  v_min := ceil(t.tempo_seg / 60.0)::int;

  -- acerto por área, no mesmo formato do "por disciplina" dos simulados
  select coalesce(jsonb_agg(jsonb_build_object('discipline_id', coalesce(a.area, 'sem_area'), 'area', true, 'nome', a.rotulo, 'total', a.total, 'acertos', a.acertos) order by a.ordem), '[]'::jsonb)
    into v_area
    from (select q.area,
                 case q.area when 'clinica' then 'Clínica Médica' when 'cirurgia' then 'Cirurgia' when 'pediatria' then 'Pediatria'
                             when 'go' then 'Ginecologia e Obstetrícia' when 'preventiva' then 'Preventiva' else 'Sem área' end as rotulo,
                 case q.area when 'clinica' then 1 when 'cirurgia' then 2 when 'pediatria' then 3 when 'go' then 4 when 'preventiva' then 5 else 6 end as ordem,
                 count(*) as total, count(*) filter (where x.correta) as acertos
            from prova_respostas x join prova_questoes q on q.id = x.questao_id
           where x.tentativa_id = t.id and not q.anulada group by q.area) a;

  insert into mock_exams (user_id, nome, data, total, acertos, tempo_min, por_disciplina, xp_ganho)
    values (v_uid, p.nome, p_dia, v_total, v_acertos, nullif(v_min, 0), v_area, p_xp) returning id into v_mock;
  insert into question_sets (user_id, banca, prova, ano, total, acertos, realizado_em, mock_exam_id)
    values (v_uid, coalesce(p.banca, 'Prova'), p.nome, p.ano, v_total, v_acertos, p_dia, v_mock) returning id into v_set;

  for r in select x.id, x.questao_id, x.chute, x.correta, q.numero, q.discipline_id, q.topic_id
             from prova_respostas x join prova_questoes q on q.id = x.questao_id
            where x.tentativa_id = t.id and not q.anulada order by q.numero loop
    insert into question_answers (user_id, question_set_id, correta, ref_questao) values (v_uid, v_set, r.correta, left(p.nome, 100) || ' · Q' || r.numero)
      returning id into v_ans;
    if not r.correta or r.chute then
      insert into error_notebook (user_id, discipline_id, topic_id, question_answer_id, enunciado, motivo)
        values (v_uid, r.discipline_id, r.topic_id, v_ans, coalesce(p_textos ->> r.questao_id::text, left(p.nome, 100) || ' · Questão ' || r.numero),
                case when r.chute then 'chute' end)
        returning id into v_err;
      update prova_respostas set erro_id = v_err where id = r.id;
      v_cad := v_cad + 1;
    end if;
  end loop;

  perform registrar_dia(p_dia, p_xp, v_min, v_total, v_acertos);
  update schedule_items set status = 'concluido'
   where id = (select id from schedule_items where user_id = v_uid and tipo = 'simulado' and data = p_dia and status <> 'concluido' order by hora_ini nulls last limit 1);
  update prova_tentativas set status = 'corrigida', corrigida_em = now(), entregue_em = coalesce(entregue_em, now()), total = v_total, acertos = v_acertos, mock_exam_id = v_mock
   where id = t.id;
  return jsonb_build_object('total', v_total, 'acertos', v_acertos, 'caderno', v_cad, 'mock_exam_id', v_mock);
end $$;
