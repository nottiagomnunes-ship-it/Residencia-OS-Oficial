-- Restaurar backup: troca os dados da pessoa pelos de um arquivo de backup, tudo ou nada, guardando antes uma cópia do estado atual (para desfazer).
-- O app já entrega os dados com identificadores novos e as ligações refeitas; aqui só se apaga o que será substituído e se insere.

-- uma cópia do estado de antes da última restauração, por pessoa (a próxima restauração a substitui)
create table restauracoes (
  user_id uuid primary key references profiles on delete cascade,
  criado_em timestamptz not null default now(),
  dados jsonb not null
);
alter table restauracoes enable row level security;
create policy own on restauracoes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Troca os dados da pessoa logada pelos informados. Só as tabelas presentes em p_dados são substituídas; as ausentes ficam como estão.
-- As tabelas são conhecidas aqui dentro (nunca vêm do arquivo), e o usuário é sempre o da sessão.
create or replace function aplicar_backup(p_dados jsonb, p_perfil jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  tabelas constant text[] := array['disciplines','topics','study_sessions','reviews','topic_tasks','review_tasks','mock_exams','question_sets','question_answers',
    'error_notebook','schedule_items','etapa_modelos','goals','achievements','commitments','daily_stats','capacidade_dia'];
  campos_perfil constant text[] := array['nome','exam_date','study_start_date','daily_minutes','available_weekdays','daily_questions_goal','review_intervals','xp','level',
    'adaptive_reviews','limite_foco','min_questoes','janela_ini','janela_fim','folga_min','modelos_semeados','ritmo_modo'];
  t text; c text; cols text; n int; v_cont jsonb := '{}'::jsonb;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  if p_dados is null or jsonb_typeof(p_dados) <> 'object' then raise exception 'Dados do backup inválidos'; end if;
  for t in select jsonb_object_keys(p_dados) loop
    if not (t = any(tabelas)) then raise exception 'Tabela desconhecida no backup: %', t; end if;
    if jsonb_typeof(p_dados -> t) <> 'array' then raise exception 'A tabela % do backup não é uma lista', t; end if;
  end loop;

  delete from cronometros where user_id = v_uid;                       -- o cronômetro aponta para tarefas que vão ser substituídas
  for i in reverse array_length(tabelas, 1)..1 loop                    -- apaga dos filhos para os pais
    if p_dados ? tabelas[i] then execute format('delete from %I where user_id = $1', tabelas[i]) using v_uid; end if;
  end loop;

  foreach t in array tabelas loop                                      -- insere dos pais para os filhos
    if not (p_dados ? t) then continue; end if;
    n := 0;
    if jsonb_array_length(p_dados -> t) > 0 then
      select string_agg(quote_ident(k), ', ') into cols from (
        select distinct k from jsonb_array_elements(p_dados -> t) r, jsonb_object_keys(r) k
         where k <> 'user_id' and exists (select 1 from information_schema.columns ic where ic.table_schema = 'public' and ic.table_name = t and ic.column_name = k
                   and ic.is_generated = 'NEVER' and coalesce(ic.identity_generation, '') <> 'ALWAYS')) ks;     -- colunas calculadas pelo banco (como "erros") não se gravam
      if cols is null then raise exception 'A tabela % do backup não tem colunas reconhecidas', t; end if;
      -- só as colunas que vieram no arquivo: as que faltam (de backups antigos) recebem o valor padrão do banco
      execute format('insert into %I (user_id, %s) select $1, %s from jsonb_populate_recordset(null::%I, $2)', t, cols, cols, t) using v_uid, p_dados -> t;
      get diagnostics n = row_count;
    end if;
    v_cont := v_cont || jsonb_build_object(t, n);
  end loop;

  if p_perfil is not null and jsonb_typeof(p_perfil) = 'object' then   -- configurações do perfil (só as permitidas)
    foreach c in array campos_perfil loop
      if p_perfil ? c and (jsonb_typeof(p_perfil -> c) <> 'null' or (select is_nullable from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = c) = 'YES') then
        execute format('update profiles set %I = (jsonb_populate_record(null::profiles, $1)).%I where id = $2', c, c) using p_perfil, v_uid;
      end if;
    end loop;
  end if;

  -- o que depende do conteúdo é refeito, para não aparecer promoção ou aviso falsos
  update profiles set nivel_visto = greatest(1, level), plano_gerado_em = null, capacidade_alterada_em = null, semana_aviso = null,
    rank_visto = (select case when x.total = 0 then 0 when x.ok * 100 >= 90 * x.total then 30 when x.ok * 100 >= 80 * x.total then 29
                              when x.ok * 100 >= 70 * x.total then 28 else (x.ok * 40) / x.total end
                    from (select count(*) as total, count(*) filter (where status = 'concluido') as ok from topics where user_id = v_uid) x)
   where id = v_uid;
  return v_cont;
end $$;

-- Restaurar: guarda a cópia do estado atual (p_snapshot, no formato do backup) e troca os dados, na mesma transação.
create or replace function restaurar_backup(p_dados jsonb, p_perfil jsonb, p_snapshot jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  insert into restauracoes (user_id, criado_em, dados) values (v_uid, now(), p_snapshot)
    on conflict (user_id) do update set criado_em = excluded.criado_em, dados = excluded.dados;
  return aplicar_backup(p_dados, p_perfil);
end $$;

-- Desfazer: volta ao estado guardado antes da última restauração (e apaga a cópia).
create or replace function desfazer_restauracao()
returns jsonb language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v jsonb; r jsonb;
begin
  select dados into v from restauracoes where user_id = v_uid;
  if v is null then raise exception 'Não há restauração para desfazer'; end if;
  r := aplicar_backup(v -> 'tabelas', v -> 'perfil');
  delete from restauracoes where user_id = v_uid;
  return r;
end $$;
