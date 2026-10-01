-- Importar o plano (ou "só limpar") passa a ser UMA transação: apagar assuntos sem histórico, criar disciplinas,
-- inserir assuntos, reordenar os que já existem e remover disciplinas vazias. Se algo falhar, nada muda.
-- O app calcula o plano; aqui só se aplica. Mesmo assim, o banco confere de novo que nunca apaga assunto com histórico
-- (questões, revisões, sessões, erros ou etapas) nem de outro usuário. Rode ESTE arquivo antes de publicar o código que o usa.
create or replace function importar_plano(p_apagar uuid[], p_disciplinas jsonb, p_novos jsonb, p_reordenar jsonb, p_limpar_disciplinas boolean)
returns jsonb language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_apagados int := 0; v_inseridos int := 0; v_removidas int := 0;
begin
  delete from topics t where t.user_id = v_uid and t.id = any(coalesce(p_apagar, '{}'::uuid[])) and t.status in ('nao_iniciado', 'planejado')
    and not exists (select 1 from question_sets x where x.topic_id = t.id)
    and not exists (select 1 from reviews x where x.topic_id = t.id)
    and not exists (select 1 from study_sessions x where x.topic_id = t.id)
    and not exists (select 1 from error_notebook x where x.topic_id = t.id)
    and not exists (select 1 from topic_tasks x where x.topic_id = t.id);
  get diagnostics v_apagados = row_count;

  insert into disciplines (user_id, nome, cor, peso, ordem)
    select v_uid, d.value->>'nome', d.value->>'cor', 3, (d.value->>'ordem')::int from jsonb_array_elements(coalesce(p_disciplinas, '[]'::jsonb)) d;

  insert into topics (user_id, discipline_id, subcategoria, nome, grupo, ordem, planned_date, planned_auto, status)
    select v_uid,
      coalesce(nullif(i.value->>'discipline_id', '')::uuid, (select d.id from disciplines d where d.user_id = v_uid and d.nome = i.value->>'disciplina_nome' limit 1)),
      nullif(i.value->>'subcategoria', ''), i.value->>'nome', nullif(i.value->>'grupo', ''), (i.value->>'ordem')::int,
      nullif(i.value->>'data', '')::date, false,
      case when nullif(i.value->>'data', '') is not null then 'planejado' else 'nao_iniciado' end
    from jsonb_array_elements(coalesce(p_novos, '[]'::jsonb)) i;
  get diagnostics v_inseridos = row_count;

  update topics t set grupo = nullif(r.value->>'grupo', ''), ordem = (r.value->>'ordem')::int
    from jsonb_array_elements(coalesce(p_reordenar, '[]'::jsonb)) r where t.id = (r.value->>'id')::uuid and t.user_id = v_uid;

  if p_limpar_disciplinas then
    delete from disciplines d where d.user_id = v_uid
      and not exists (select 1 from topics x where x.discipline_id = d.id)
      and not exists (select 1 from question_sets x where x.discipline_id = d.id)
      and not exists (select 1 from error_notebook x where x.discipline_id = d.id);
    get diagnostics v_removidas = row_count;
  end if;
  return jsonb_build_object('apagados', v_apagados, 'inseridos', v_inseridos, 'disciplinas_removidas', v_removidas);
end $$;
