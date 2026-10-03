-- Tutorial de boas-vindas: aparece uma única vez, na primeira vez que uma conta NOVA abre o app.
-- Quem já usava o app não vê o tutorial (é marcado como visto aqui); ele pode ser revisto na página Ajuda.
-- Pode ser executada mais de uma vez: a marcação das contas antigas só acontece quando o campo é criado.
do $$ begin
  if not exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'tutorial_visto_em') then
    alter table profiles add column tutorial_visto_em timestamptz;
    update profiles set tutorial_visto_em = now();
  end if;
end $$;
