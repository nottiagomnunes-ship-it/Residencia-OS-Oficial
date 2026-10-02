-- Avisos de promoção: guarda o maior rank e o nível já comemorados, para celebrar uma vez só (e não de novo se o rank cair e voltar).
alter table profiles add column rank_visto int not null default 0, add column nivel_visto int not null default 1;

-- quem já tem progresso começa "em dia": nenhuma promoção surge de uma vez pelo que já foi feito
update profiles set nivel_visto = greatest(1, level);
update profiles p set rank_visto = case
    when x.c * 100 >= 90 * x.t then 30 when x.c * 100 >= 80 * x.t then 29 when x.c * 100 >= 70 * x.t then 28 else (x.c * 40) / x.t end
  from (select user_id, count(*) as t, count(*) filter (where status = 'concluido') as c from topics group by user_id) x
  where x.user_id = p.id and x.t > 0;
