-- Antes dos testadores: (1) "Sugestões e problemas" — quem usa manda uma mensagem, a administradora lê, responde e marca como resolvida;
-- (2) erros do site — o navegador (tela "Algo deu errado") e o servidor registram os erros para a administradora ver na Administração.
-- Pode ser executada mais de uma vez (depois da 0037, que criou eh_admin).

create table if not exists mensagens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references profiles on delete cascade,
  tipo text not null check (tipo in ('sugestao', 'problema', 'outro')),
  texto text not null check (length(texto) between 3 and 4000),
  pagina text check (length(pagina) <= 300),
  navegador text check (length(navegador) <= 300),
  criada_em timestamptz not null default now(),
  resposta text check (length(resposta) <= 4000),
  respondida_em timestamptz,
  resolvida_em timestamptz
);
create index if not exists mensagens_abertas on mensagens (resolvida_em, criada_em);
alter table mensagens enable row level security;
drop policy if exists "mensagens: quem enviou vê" on mensagens;
drop policy if exists "mensagens: quem enviou envia" on mensagens;
drop policy if exists "mensagens: admin vê" on mensagens;
drop policy if exists "mensagens: admin responde" on mensagens;
create policy "mensagens: quem enviou vê" on mensagens for select to authenticated using (user_id = auth.uid());
-- quem envia não escolhe resposta nem estado
create policy "mensagens: quem enviou envia" on mensagens for insert to authenticated
  with check (user_id = auth.uid() and resposta is null and respondida_em is null and resolvida_em is null);
create policy "mensagens: admin vê" on mensagens for select to authenticated using (eh_admin());
create policy "mensagens: admin responde" on mensagens for update to authenticated using (eh_admin()) with check (eh_admin());

-- no máximo 10 mensagens por hora por conta (evita enxurrada por engano)
create or replace function limitar_mensagens() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from mensagens where user_id = new.user_id and criada_em > now() - interval '1 hour') >= 10 then
    raise exception 'Muitas mensagens em pouco tempo. Tente de novo mais tarde.';
  end if;
  return new;
end $$;
drop trigger if exists limitar_mensagens on mensagens;
create trigger limitar_mensagens before insert on mensagens for each row execute function limitar_mensagens();

create table if not exists erros_app (
  id uuid primary key default gen_random_uuid(),
  criado_em timestamptz not null default now(),
  origem text not null check (origem in ('navegador', 'servidor')),
  mensagem text not null check (length(mensagem) <= 1000),
  digest text check (length(digest) <= 100),
  pagina text check (length(pagina) <= 300),
  detalhe text check (length(detalhe) <= 4000),
  navegador text check (length(navegador) <= 300),
  user_id uuid default auth.uid() references profiles on delete set null
);
create index if not exists erros_app_recentes on erros_app (criado_em desc);
alter table erros_app enable row level security;
drop policy if exists "erros: quem usa registra" on erros_app;
drop policy if exists "erros: admin vê" on erros_app;
drop policy if exists "erros: admin apaga" on erros_app;
-- o navegador registra só em nome da própria conta; o servidor registra com a chave de serviço (ignora a RLS)
create policy "erros: quem usa registra" on erros_app for insert to authenticated with check (user_id = auth.uid() and origem = 'navegador');
create policy "erros: admin vê" on erros_app for select to authenticated using (eh_admin());
create policy "erros: admin apaga" on erros_app for delete to authenticated using (eh_admin());

-- no máximo 30 erros por hora por conta vindos do navegador (uma tela quebrada em loop não enche a tabela)
create or replace function limitar_erros() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.user_id is not null and (select count(*) from erros_app where user_id = new.user_id and criado_em > now() - interval '1 hour') >= 30 then
    return null; -- descarta em silêncio
  end if;
  return new;
end $$;
drop trigger if exists limitar_erros on erros_app;
create trigger limitar_erros before insert on erros_app for each row execute function limitar_erros();
