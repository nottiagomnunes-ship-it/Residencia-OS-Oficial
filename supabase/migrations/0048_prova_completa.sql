-- Prova completa a partir do banco (no lugar de cada pessoa importar a própria prova):
-- (1) número da questão na prova original (banco_questoes.numero e banco_geral.numero): vem da importação (PDF/.docx de uma prova inteira, ou o
--     campo "numero" do pacote), vai junto ao publicar e chega às contas; reimportar o mesmo arquivo preenche o número das que já estavam;
-- (2) montar_prova_completa(banca, ano): todas as questões dessa banca e ano, na ordem da prova, como PROVA (cronômetro, resultado em Simulados);
-- (3) a correção da prova passa a contar nas questões do banco (acerto por tema, fila de refazer, Caderno ligado à questão).
-- Pode ser executada mais de uma vez (depois da 0045).

alter table banco_questoes add column if not exists numero int check (numero between 1 and 999);
alter table banco_geral add column if not exists numero int check (numero between 1 and 999);
alter table provas add column if not exists do_banco boolean not null default false;
create index if not exists banco_questoes_prova on banco_questoes (user_id, banca, ano);

create or replace function marcar_alterada() returns trigger language plpgsql set search_path = public as $$
begin
  if (new.blocos, new.alternativas, new.gabarito, new.gabarito_origem, new.anulada, new.tema_id, new.explicacao, new.explicacao_origem, new.banca, new.ano, new.area, new.assunto, new.numero)
     is distinct from (old.blocos, old.alternativas, old.gabarito, old.gabarito_origem, old.anulada, old.tema_id, old.explicacao, old.explicacao_origem, old.banca, old.ano, old.area, old.assunto, old.numero)
  then new.alterada_em := now(); end if;
  return new;
end $$;

create or replace function importar_banco(p_itens jsonb)
returns int language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); n int;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  insert into banco_questoes (user_id, hash, blocos, alternativas, gabarito, gabarito_origem, anulada, comentario, area, discipline_id, topic_id, assunto, banca, ano, fonte, numero)
    select v_uid, i ->> 'hash', i -> 'blocos', i -> 'alternativas', nullif(i ->> 'gabarito', ''), nullif(i ->> 'gabarito_origem', ''),
           coalesce((i ->> 'anulada')::boolean, false), nullif(i ->> 'comentario', ''), nullif(i ->> 'area', ''),
           nullif(i ->> 'discipline_id', '')::uuid, nullif(i ->> 'topic_id', '')::uuid, nullif(i ->> 'assunto', ''),
           nullif(i ->> 'banca', ''), nullif(i ->> 'ano', '')::int, nullif(i ->> 'fonte', ''),
           case when (i ->> 'numero') ~ '^[0-9]{1,3}$' and (i ->> 'numero')::int between 1 and 999 then (i ->> 'numero')::int end
      from jsonb_array_elements(p_itens) i
    on conflict (user_id, hash) do nothing;
  get diagnostics n = row_count;
  return n;
end $$;

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
             anulada = b.anulada, area = b.area_final, disciplina = b.disc_nome, assunto = b.assunto_final, banca = b.banca, ano = b.ano, numero = b.numero, tema_id = b.tema_id, explicacao = b.explicacao, explicacao_origem = b.explicacao_origem,
             colecao = coalesce(nullif(trim(p_colecao), ''), colecao), atualizada_em = now(),
             hash = case when exists (select 1 from banco_geral o where o.hash = b.hash and o.id <> v_id) then hash else b.hash end
       where id = v_id;
      update banco_questoes set sincronizada_em = now() where id = b.id; -- publicada agora: não fica "falta publicar"
      n_atual := n_atual + 1;
    else
      insert into banco_geral (hash, blocos, alternativas, gabarito, gabarito_origem, anulada, area, disciplina, assunto, banca, ano, colecao, publicada_por, tema_id, explicacao, explicacao_origem, numero)
        values (b.hash, coalesce(i -> 'blocos', b.blocos), b.alternativas, b.gabarito, b.gabarito_origem, b.anulada, b.area_final, b.disc_nome, b.assunto_final, b.banca, b.ano,
                nullif(trim(p_colecao), ''), v_uid, b.tema_id, b.explicacao, b.explicacao_origem, b.numero)
        on conflict (hash) do update set blocos = excluded.blocos, alternativas = excluded.alternativas, gabarito = excluded.gabarito,
             gabarito_origem = excluded.gabarito_origem, anulada = excluded.anulada, area = excluded.area, disciplina = excluded.disciplina,
             assunto = excluded.assunto, banca = excluded.banca, ano = excluded.ano, numero = excluded.numero, colecao = coalesce(excluded.colecao, banco_geral.colecao), tema_id = excluded.tema_id, explicacao = excluded.explicacao, explicacao_origem = excluded.explicacao_origem, atualizada_em = now()
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
         anulada = g.anulada, banca = coalesce(g.banca, b.banca), ano = coalesce(g.ano, b.ano), numero = coalesce(g.numero, b.numero), sincronizada_em = now(),
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
     and (b.blocos, b.alternativas, b.gabarito, b.gabarito_origem, b.anulada, b.tema_id, b.explicacao, b.banca, b.ano, b.numero) is distinct from (g.blocos, g.alternativas, g.gabarito, g.gabarito_origem, g.anulada, g.tema_id, g.explicacao, coalesce(g.banca, b.banca), coalesce(g.ano, b.ano), coalesce(g.numero, b.numero));
  get diagnostics n_corr = row_count;
  update banco_questoes b set sincronizada_em = now() from banco_geral g
   where b.user_id = v_uid and b.origem_geral = g.id and b.sincronizada_em is null;

  -- novas: disciplina e assunto ligados pelo nome aos da pessoa (se ela tiver); senão ficam a área e o nome do assunto
  insert into banco_questoes (user_id, hash, blocos, alternativas, gabarito, gabarito_origem, anulada, area, discipline_id, topic_id, assunto, banca, ano, fonte, origem_geral, sincronizada_em, tema_id, explicacao, explicacao_origem, numero)
    select v_uid, g.hash, g.blocos, g.alternativas, g.gabarito, g.gabarito_origem, g.anulada, g.area, d.id, t.id, g.assunto, g.banca, g.ano,
           'Banco geral' || coalesce(' · ' || g.colecao, ''), g.id, now(), g.tema_id, g.explicacao, g.explicacao_origem, g.numero
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

  for r in select x.id, x.questao_id, x.chute, x.correta, q.numero, q.discipline_id, q.topic_id, q.banco_questao_id
             from prova_respostas x join prova_questoes q on q.id = x.questao_id
            where x.tentativa_id = t.id and not q.anulada order by q.numero loop
    insert into question_answers (user_id, question_set_id, correta, ref_questao) values (v_uid, v_set, r.correta, left(p.nome, 100) || ' · Q' || r.numero)
      returning id into v_ans;
    if not r.correta or r.chute then
      insert into error_notebook (user_id, discipline_id, topic_id, question_answer_id, enunciado, motivo, banco_questao_id)
        values (v_uid, r.discipline_id, r.topic_id, v_ans, coalesce(p_textos ->> r.questao_id::text, left(p.nome, 100) || ' · Questão ' || r.numero),
                case when r.chute then 'chute' end, r.banco_questao_id)
        returning id into v_err;
      update prova_respostas set erro_id = v_err where id = r.id;
      v_cad := v_cad + 1;
    end if;
    -- prova feita a partir do banco: conta na questão (acerto por tema, fila de refazer), como no Praticar e nas listas
    if r.banco_questao_id is not null then
      update banco_questoes set vezes = vezes + 1, acertos = acertos + (case when r.correta then 1 else 0 end), ultima_em = now(), ultimo_certo = r.correta
       where id = r.banco_questao_id and user_id = v_uid;
    end if;
  end loop;

  perform registrar_dia(p_dia, p_xp, v_min, v_total, v_acertos);
  update schedule_items set status = 'concluido'
   where id = (select id from schedule_items where user_id = v_uid and tipo = 'simulado' and data = p_dia and status <> 'concluido' order by hora_ini nulls last limit 1);
  update prova_tentativas set status = 'corrigida', corrigida_em = now(), entregue_em = coalesce(entregue_em, now()), total = v_total, acertos = v_acertos, mock_exam_id = v_mock
   where id = t.id;
  return jsonb_build_object('total', v_total, 'acertos', v_acertos, 'caderno', v_cad, 'mock_exam_id', v_mock);
end $$;

-- A prova completa: as questões da banca e do ano (com gabarito, ou anuladas), na ordem do número na prova; sem número, pela ordem em que entraram.
-- Se já existe uma prova completa dessa banca e ano com tentativa em andamento, continua nela; se as questões são as mesmas de uma feita antes, refaz nela.
create or replace function montar_prova_completa(p_banca text, p_ano int)
returns uuid language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_prova uuid; v_tent uuid; n int;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  select t.id into v_tent from prova_tentativas t join provas p on p.id = t.prova_id
   where p.user_id = v_uid and p.do_banco and p.banca = p_banca and p.ano = p_ano and t.status <> 'corrigida' order by t.iniciada_em desc limit 1;
  if v_tent is not null then return v_tent; end if;
  select count(*) into n from banco_questoes where user_id = v_uid and banca = p_banca and ano = p_ano and (gabarito is not null or anulada);
  if n = 0 then raise exception 'Nenhuma questão dessa prova no banco'; end if;
  if n > 200 then raise exception 'Prova grande demais (mais de 200 questões)'; end if;
  -- refazer: se já existe a prova completa com exatamente as mesmas questões, uma nova tentativa nela (não duplica em "Suas provas")
  select p.id into v_prova from provas p where p.user_id = v_uid and p.do_banco and p.banca = p_banca and p.ano = p_ano
     and (select coalesce(array_agg(q.banco_questao_id order by q.banco_questao_id), '{}') from prova_questoes q where q.prova_id = p.id)
       = (select coalesce(array_agg(b.id order by b.id), '{}') from banco_questoes b where b.user_id = v_uid and b.banca = p_banca and b.ano = p_ano and (b.gabarito is not null or b.anulada))
   order by p.criada_em desc limit 1;
  if v_prova is not null then
    insert into prova_tentativas (user_id, prova_id) values (v_uid, v_prova) returning id into v_tent;
    return v_tent;
  end if;
  insert into provas (user_id, nome, banca, ano, tipo, do_banco) values (v_uid, left(p_banca || ' ' || p_ano, 120), p_banca, p_ano, 'prova', true) returning id into v_prova;
  insert into prova_questoes (user_id, prova_id, numero, blocos, alternativas, gabarito, anulada, area, discipline_id, topic_id, banco_questao_id)
    select v_uid, v_prova, row_number() over (order by b.numero nulls last, b.criada_em, b.id)::int, b.blocos, b.alternativas, b.gabarito, b.anulada,
           coalesce(te.area, b.area), b.discipline_id, b.topic_id, b.id
      from banco_questoes b left join temas te on te.id = b.tema_id
     where b.user_id = v_uid and b.banca = p_banca and b.ano = p_ano and (b.gabarito is not null or b.anulada);
  insert into prova_tentativas (user_id, prova_id) values (v_uid, v_prova) returning id into v_tent;
  return v_tent;
end $$;
