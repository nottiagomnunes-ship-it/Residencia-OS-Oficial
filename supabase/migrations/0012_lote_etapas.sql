-- identifica as etapas criadas por uma aplicação em lote, para poder desfazer o último lote
alter table topic_tasks add column lote_id uuid;
create index on topic_tasks (lote_id) where lote_id is not null;
