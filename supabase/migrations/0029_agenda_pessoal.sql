-- Agenda pessoal (internato, plantões, academia, aulas, compromissos), separada do estudo.
-- Reaproveita a tabela de compromissos do modelo antigo de "Minha semana": cada horário ganha uma categoria (cor) e a marca "agenda".
-- Os horários antigos continuam fora da agenda (agenda = false) até você escolher trazê-los na página Agenda.
-- Nada aqui mexe no estudo: o gerador de cronograma não lê esta tabela. Pode ser executada mais de uma vez.
alter table commitments add column if not exists categoria text not null default 'outro'
  check (categoria in ('internato', 'plantao', 'academia', 'aula', 'compromisso', 'outro'));
alter table commitments add column if not exists agenda boolean not null default false;
create index if not exists commitments_agenda on commitments (user_id) where agenda;
