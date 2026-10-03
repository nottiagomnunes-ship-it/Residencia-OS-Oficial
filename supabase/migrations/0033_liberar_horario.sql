-- Liberar um horário da agenda pessoal só num dia: um horário de "toda semana" (internato, academia...) pode ficar livre numa data,
-- sem mexer nas outras semanas. As datas liberadas ficam em "excecoes" (a data em que a ocorrência começa).
-- Pode ser executada mais de uma vez.
alter table commitments add column if not exists excecoes date[] not null default '{}';
