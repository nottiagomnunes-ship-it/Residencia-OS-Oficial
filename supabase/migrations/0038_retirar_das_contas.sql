-- "Tirar do banco geral" passa a tirar a questão também do banco de TODAS as outras contas (antes, quem já tinha recebido ficava com a cópia).
-- O histórico das pessoas não muda: Desempenho, XP e Caderno de Erros ficam em outras tabelas. O banco da administradora não muda.
-- Também limpa cópias de questões tiradas antes desta migração (já sem ligação): reconhece pela impressão digital e pela fonte "Banco geral".
-- Pode ser executada mais de uma vez.

drop function if exists retirar_do_banco_geral(uuid[]);

-- security definer: precisa apagar linhas de outras contas (a RLS não deixaria). Por isso confere a administradora logo no começo
-- e só considera questões do PRÓPRIO banco dela como ponto de partida.
create or replace function retirar_do_banco_geral(p_ids uuid[])
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_gerais uuid[]; v_hashes text[]; n_copias int; n_geral int;
begin
  if v_uid is null or not eh_admin() then raise exception 'Só a conta administradora mexe no banco geral'; end if;
  select coalesce(array_agg(origem_geral) filter (where origem_geral is not null), '{}'), coalesce(array_agg(hash), '{}')
    into v_gerais, v_hashes
    from banco_questoes where id = any(p_ids) and user_id = v_uid;

  -- as cópias nas outras contas que VIERAM do banco geral (fonte "Banco geral..."): ligadas à questão geral ou, se tiradas antes, sem ligação
  -- e com o mesmo texto. Se a pessoa já tinha a questão por conta própria (importou o mesmo arquivo), ela fica, só perde a ligação.
  perform set_config('app.apagando_tudo', '1', true); -- não conta como "a pessoa excluiu" (essas questões nem existem mais no geral)
  delete from banco_questoes
   where user_id <> v_uid
     and fonte like 'Banco geral%'
     and (origem_geral = any(v_gerais) or (origem_geral is null and hash = any(v_hashes)));
  get diagnostics n_copias = row_count;
  perform set_config('app.apagando_tudo', '', true);

  delete from banco_geral where id = any(v_gerais);
  get diagnostics n_geral = row_count;
  return jsonb_build_object('geral', n_geral, 'copias', n_copias);
end $$;
revoke execute on function retirar_do_banco_geral(uuid[]) from public, anon;
grant execute on function retirar_do_banco_geral(uuid[]) to authenticated;
