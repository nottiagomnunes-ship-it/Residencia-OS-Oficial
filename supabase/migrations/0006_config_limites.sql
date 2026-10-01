-- limites de desempenho editáveis nas Configurações (antes fixos no código)
alter table profiles
  add column limite_foco int not null default 65 check (limite_foco between 1 and 100),
  add column min_questoes int not null default 10 check (min_questoes between 1 and 100);
