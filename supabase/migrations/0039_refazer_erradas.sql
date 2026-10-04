-- Refazer as questões erradas: cada questão do banco que você erra (no Praticar ou numa lista) volta para você refazer
-- em 1 dia; acertando, volta em 7 dias; acertando de novo, em 30 dias; acertando a terceira vez, sai da fila.
-- Errou no meio do caminho: recomeça (1 dia). Acertar no chute conta como erro. Questões erradas antes desta migração entram já para hoje.
-- Pode ser executada mais de uma vez.

create table if not exists revisao_questoes (
  user_id uuid not null references profiles on delete cascade,
  questao_id uuid not null references banco_questoes on delete cascade,
  etapa int not null default 0 check (etapa between 0 and 3),  -- 0: refazer em 1 dia · 1: em 7 · 2: em 30 · 3: concluída
  proxima date,                                                  -- quando refazer; null depois de concluída
  erros int not null default 1,
  criada_em timestamptz not null default now(),
  atualizada_em timestamptz not null default now(),
  primary key (user_id, questao_id)
);
create index if not exists revisao_questoes_proxima on revisao_questoes (user_id, proxima);
alter table revisao_questoes enable row level security;
drop policy if exists own on revisao_questoes;
create policy own on revisao_questoes for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create or replace function hoje_br() returns date language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

-- Errou (ou chutou): volta para a etapa 0, para refazer amanhã.
create or replace function marcar_para_refazer(p_uid uuid, p_questao uuid) returns void language plpgsql set search_path = public as $$
begin
  insert into revisao_questoes (user_id, questao_id, etapa, proxima) values (p_uid, p_questao, 0, hoje_br() + 1)
  on conflict (user_id, questao_id) do update set etapa = 0, proxima = hoje_br() + 1, erros = revisao_questoes.erros + 1, atualizada_em = now();
end $$;

-- Toda vez que uma questão do banco é respondida (Praticar ou lista, que aumentam "vezes"), a fila de refazer anda sozinha.
create or replace function andar_revisao_da_questao() returns trigger language plpgsql set search_path = public as $$
begin
  if new.vezes <= old.vezes then return new; end if;
  if new.ultimo_certo is false then
    perform marcar_para_refazer(new.user_id, new.id);
  elsif new.ultimo_certo then
    -- acertou uma que estava para refazer (hoje ou atrasada): próxima etapa. Antes do dia, não conta (ainda é cedo para saber se fixou).
    update revisao_questoes set etapa = etapa + 1,
           proxima = case etapa when 0 then hoje_br() + 7 when 1 then hoje_br() + 30 else null end, atualizada_em = now()
     where user_id = new.user_id and questao_id = new.id and proxima is not null and proxima <= hoje_br();
  end if;
  return new;
end $$;
drop trigger if exists andar_revisao_da_questao on banco_questoes;
create trigger andar_revisao_da_questao after update of vezes on banco_questoes for each row execute function andar_revisao_da_questao();

-- Chute certo: o app chama esta depois de responder (o banco não sabe que foi chute). Só as questões da própria pessoa.
create or replace function refazer_chutes(p_ids uuid[]) returns int language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); r record; n int := 0;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  for r in select id from banco_questoes where id = any(p_ids) and user_id = v_uid loop
    perform marcar_para_refazer(v_uid, r.id); n := n + 1;
  end loop;
  return n;
end $$;

-- As que você já tinha errado (na última vez) entram para refazer hoje.
insert into revisao_questoes (user_id, questao_id, etapa, proxima)
  select user_id, id, 0, hoje_br() from banco_questoes where ultimo_certo is false
on conflict (user_id, questao_id) do nothing;
