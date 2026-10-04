-- Palavras-chave dos temas (ex.: "Bloqueadores neuromusculares" → rocurônio, succinilcolina, sugamadex): ajudam o
-- "Sugerir tema pelo texto" a achar o tema mesmo quando o nome dele não aparece no enunciado. Pode ser executada mais de uma vez.
alter table temas add column if not exists palavras text;
