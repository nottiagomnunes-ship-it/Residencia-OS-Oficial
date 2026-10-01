-- ordem de estudo definida pelo usuário na importação (ex.: "Semana 1", "Semana 2") e posição do assunto na sequência
alter table topics add column grupo text, add column ordem int;
create index on topics (user_id, ordem);
