-- Como mostrar o ritmo para a prova: 'resumo' (padrão: uma linha discreta no Início, detalhes no Cronograma),
-- 'completo' (card inteiro também no Início) ou 'oculto' (não mostra em lugar nenhum).
alter table profiles add column ritmo_modo text not null default 'resumo' check (ritmo_modo in ('completo', 'resumo', 'oculto'));
