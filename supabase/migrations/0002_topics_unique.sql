-- evita assuntos duplicados na mesma disciplina (permite importar o catálogo mais de uma vez)
alter table topics add constraint topics_disc_nome_key unique (discipline_id, nome);
