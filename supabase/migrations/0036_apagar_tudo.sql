-- Apagar tudo: deixa a conta como recém-criada (o login continua). Apaga os dados de TODAS as tabelas da pessoa e volta o perfil ao padrão.
-- Genérico de propósito: pega toda tabela do app que tenha "user_id" (inclusive as que forem criadas no futuro) e repete as passadas
-- até não sobrar nada (assim a ordem das ligações entre tabelas não importa). Tudo numa transação: ou apaga tudo, ou nada.
-- Pode ser executada mais de uma vez.
create or replace function apagar_tudo()
returns jsonb language plpgsql set search_path = public as $$
declare
  v_uid uuid := auth.uid(); t text; n int; restam int; passada int := 0; v_total int := 0; sets text;
  tabelas text[];
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
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
