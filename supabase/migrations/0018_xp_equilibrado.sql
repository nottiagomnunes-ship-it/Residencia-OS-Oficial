-- XP mais justo + consistência: guarda o XP ganho em cada sessão de questões e simulado (para devolver ao excluir),
-- conta o tempo digitado nas questões nas horas estudadas e impede estatísticas negativas.
-- Rode UMA vez (o passo de "recontar" o tempo das questões antigas só deve acontecer uma vez).
alter table question_sets add column xp_ganho int;
alter table mock_exams add column xp_ganho int;

-- XP, nível e estatísticas do dia. Aceita valores negativos (ao excluir) sem passar de zero.
create or replace function registrar_dia(p_dia date, p_xp int, p_min int, p_q int, p_ac int)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_xp int;
begin
  update profiles set xp = greatest(0, xp + p_xp) where id = v_uid returning xp into v_xp;
  update profiles set level = v_xp / 500 + 1 where id = v_uid;
  insert into daily_stats (user_id, data, minutos, questoes, acertos, xp) values (v_uid, p_dia, greatest(0, p_min), greatest(0, p_q), greatest(0, p_ac), greatest(0, p_xp))
  on conflict (user_id, data) do update set minutos = greatest(0, daily_stats.minutos + p_min), questoes = greatest(0, daily_stats.questoes + p_q),
    acertos = greatest(0, daily_stats.acertos + p_ac), xp = greatest(0, daily_stats.xp + p_xp);
end $$;

-- Registrar questões: agora guarda o XP ganho e soma o tempo digitado às horas estudadas.
create or replace function registrar_questoes(p_disc uuid, p_topic uuid, p_banca text, p_prova text, p_ano int, p_total int, p_acertos int,
  p_tempo int, p_dif int, p_dia date, p_xp int)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_bloco uuid; v_etapa uuid;
begin
  insert into question_sets (user_id, discipline_id, topic_id, banca, prova, ano, total, acertos, tempo_min, dificuldade, realizado_em, xp_ganho)
    values (v_uid, p_disc, p_topic, p_banca, p_prova, p_ano, p_total, p_acertos, p_tempo, p_dif, p_dia, p_xp);
  perform registrar_dia(p_dia, p_xp, coalesce(p_tempo, 0), p_total, p_acertos);
  select id into v_bloco from schedule_items where user_id = v_uid and tipo = 'questoes' and data = p_dia and status <> 'concluido'
    and p_total >= coalesce(qtd_questoes, 0) order by hora_ini nulls last limit 1;
  if v_bloco is not null then update schedule_items set status = 'concluido' where id = v_bloco; end if;
  if p_topic is not null then
    select id into v_etapa from topic_tasks where user_id = v_uid and topic_id = p_topic and tipo = 'questoes' and concluida = false
      and p_total >= coalesce(qtd_questoes, 0) order by ordem limit 1;
    if v_etapa is not null then update topic_tasks set concluida = true, concluida_em = now() where id = v_etapa; end if;
  end if;
end $$;

-- Excluir uma sessão de questões: devolve o XP, o tempo e as questões/acertos do dia. Sessões de simulado se excluem pelo simulado.
create or replace function excluir_questoes(p_id uuid)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); q record;
begin
  select * into q from question_sets where id = p_id and user_id = v_uid for update;
  if not found or q.mock_exam_id is not null then return; end if;
  delete from question_sets where id = p_id;
  perform registrar_dia(q.realizado_em, -coalesce(q.xp_ganho, q.total / 5), -coalesce(q.tempo_min, 0), -q.total, -q.acertos); -- sem xp_ganho: regra antiga (1 XP a cada 5)
end $$;

-- Excluir um simulado: tira também as questões ligadas a ele (cascata) e devolve XP, tempo e questões do dia.
create or replace function excluir_simulado(p_id uuid)
returns void language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); m record;
begin
  select * into m from mock_exams where id = p_id and user_id = v_uid for update;
  if not found then return; end if;
  delete from mock_exams where id = p_id;
  perform registrar_dia(m.data, -coalesce(m.xp_ganho, 20 + m.total / 5), -coalesce(m.tempo_min, 0), -m.total, -m.acertos); -- sem xp_ganho: regra antiga
end $$;

-- Recontar uma vez: o tempo das questões antigas (que não eram somadas às horas estudadas). Simulados já contavam o próprio tempo.
insert into daily_stats (user_id, data, minutos)
  select user_id, realizado_em, sum(tempo_min) from question_sets where mock_exam_id is null and coalesce(tempo_min, 0) > 0 group by user_id, realizado_em
on conflict (user_id, data) do update set minutos = daily_stats.minutos + excluded.minutos;
