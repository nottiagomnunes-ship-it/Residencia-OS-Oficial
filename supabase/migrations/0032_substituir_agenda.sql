-- Substituir a escala de uma semana na agenda pessoal, tudo ou nada: apaga os horários de "um dia só" entre p_de e p_ate
-- e grava os novos. Os de "toda semana" (academia, por exemplo) e os horários antigos (fora da agenda) não são tocados.
-- Pode ser executada mais de uma vez.
create or replace function substituir_agenda_semana(p_de date, p_ate date, p_itens jsonb)
returns jsonb language plpgsql set search_path = public as $$
declare v_uid uuid := auth.uid(); v_rem int; v_ins int;
begin
  if v_uid is null then raise exception 'Sem usuário autenticado'; end if;
  if p_ate < p_de or p_ate - p_de > 13 then raise exception 'Intervalo inválido'; end if;
  delete from commitments where user_id = v_uid and agenda and tipo = 'pontual' and data between p_de and p_ate;
  get diagnostics v_rem = row_count;
  insert into commitments (user_id, titulo, categoria, tipo, dias, data, hora_ini, hora_fim, agenda)
    select v_uid, left(i ->> 'titulo', 80), coalesce(nullif(i ->> 'categoria', ''), 'outro'), 'pontual', '{}', (i ->> 'data')::date,
           (i ->> 'hora_ini')::time, (i ->> 'hora_fim')::time, true
      from jsonb_array_elements(coalesce(p_itens, '[]'::jsonb)) i;
  get diagnostics v_ins = row_count;
  return jsonb_build_object('removidos', v_rem, 'inseridos', v_ins);
end $$;
