-- Só a administração adiciona questões e provas (o aluno pede a prova). Fecha os caminhos que não passavam pela tela:
-- (1) importar_banco passa a exigir a conta administradora; (2) salvar_prova (importação de prova pelo aluno, que saiu do app) é removida;
-- (3) inserir direto nas tabelas banco_questoes, provas e prova_questoes pela API (sem passar por uma função do app) só para a administradora.
--     As funções do app (sincronizar o banco geral, montar lista, prova completa, restaurar backup) continuam funcionando.
-- Pode ser executada mais de uma vez (depois da 0048).

create or replace function importar_banco(p_itens jsonb)
returns int language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); n int;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  if not eh_admin() then raise exception 'Só a administração adiciona questões ao banco' using errcode = '42501'; end if;
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

drop function if exists salvar_prova(jsonb, jsonb);

-- O PostgREST informa o caminho pedido em request.path: "/banco_questoes" (tabela) ou "/rpc/<função>". Só o acesso direto à tabela é barrado.
-- Sem essa informação (SQL Editor, servidor com a chave de serviço), nada muda.
create or replace function so_pelo_app() returns trigger language plpgsql set search_path = public as $$
begin
  if coalesce(current_setting('request.path', true), '') ~* '^/(rest/v1/)?(banco_questoes|provas|prova_questoes)([/?]|$)' and not eh_admin() then
    raise exception 'Questões e provas entram pelo app: peça a prova em Ajustes → Sugestões' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists so_pelo_app on banco_questoes;
drop trigger if exists so_pelo_app on provas;
drop trigger if exists so_pelo_app on prova_questoes;
create trigger so_pelo_app before insert on banco_questoes for each row execute function so_pelo_app();
create trigger so_pelo_app before insert on provas for each row execute function so_pelo_app();
create trigger so_pelo_app before insert on prova_questoes for each row execute function so_pelo_app();
