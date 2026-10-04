-- Área de Administração: saber quais questões a administradora ALTEROU depois de publicar ("falta publicar").
-- alterada_em muda sozinha quando o conteúdo da questão muda (enunciado, alternativas, gabarito, anulada, tema, explicação, banca, ano,
-- área, assunto); pendente_publicar = publicada e alterada depois da última publicação. Pode ser executada mais de uma vez (depois da 0042).

alter table banco_questoes add column if not exists alterada_em timestamptz;

create or replace function marcar_alterada() returns trigger language plpgsql set search_path = public as $$
begin
  if (new.blocos, new.alternativas, new.gabarito, new.gabarito_origem, new.anulada, new.tema_id, new.explicacao, new.explicacao_origem, new.banca, new.ano, new.area, new.assunto)
     is distinct from (old.blocos, old.alternativas, old.gabarito, old.gabarito_origem, old.anulada, old.tema_id, old.explicacao, old.explicacao_origem, old.banca, old.ano, old.area, old.assunto)
  then new.alterada_em := now(); end if;
  return new;
end $$;
drop trigger if exists marcar_alterada on banco_questoes;
create trigger marcar_alterada before update on banco_questoes for each row execute function marcar_alterada();

alter table banco_questoes add column if not exists pendente_publicar boolean
  generated always as (origem_geral is not null and coalesce(alterada_em > sincronizada_em, false)) stored;

-- Publicar de novo também marca a sua questão como publicada agora (antes só as novas eram marcadas).
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
             anulada = b.anulada, area = b.area_final, disciplina = b.disc_nome, assunto = b.assunto_final, banca = b.banca, ano = b.ano, tema_id = b.tema_id, explicacao = b.explicacao, explicacao_origem = b.explicacao_origem,
             colecao = coalesce(nullif(trim(p_colecao), ''), colecao), atualizada_em = now(),
             hash = case when exists (select 1 from banco_geral o where o.hash = b.hash and o.id <> v_id) then hash else b.hash end
       where id = v_id;
      update banco_questoes set sincronizada_em = now() where id = b.id; -- publicada agora: não fica "falta publicar"
      n_atual := n_atual + 1;
    else
      insert into banco_geral (hash, blocos, alternativas, gabarito, gabarito_origem, anulada, area, disciplina, assunto, banca, ano, colecao, publicada_por, tema_id, explicacao, explicacao_origem)
        values (b.hash, coalesce(i -> 'blocos', b.blocos), b.alternativas, b.gabarito, b.gabarito_origem, b.anulada, b.area_final, b.disc_nome, b.assunto_final, b.banca, b.ano,
                nullif(trim(p_colecao), ''), v_uid, b.tema_id, b.explicacao, b.explicacao_origem)
        on conflict (hash) do update set blocos = excluded.blocos, alternativas = excluded.alternativas, gabarito = excluded.gabarito,
             gabarito_origem = excluded.gabarito_origem, anulada = excluded.anulada, area = excluded.area, disciplina = excluded.disciplina,
             assunto = excluded.assunto, banca = excluded.banca, ano = excluded.ano, colecao = coalesce(excluded.colecao, banco_geral.colecao), tema_id = excluded.tema_id, explicacao = excluded.explicacao, explicacao_origem = excluded.explicacao_origem, atualizada_em = now()
        returning id, (xmax = 0) into v_id, v_nova; -- xmax = 0: a linha foi inserida (não atualizada)
      if v_nova then n_novas := n_novas + 1; else n_atual := n_atual + 1; end if;
      update banco_questoes set origem_geral = v_id, sincronizada_em = now() where id = b.id;
    end if;
  end loop;
  return jsonb_build_object('novas', n_novas, 'atualizadas', n_atual);
end $$;
