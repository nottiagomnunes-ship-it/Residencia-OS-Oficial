-- aviso de conquista nova: fica pendente (visto = false) até o usuário dispensar o banner.
-- As conquistas que já existiam entram como vistas, para não virarem "novas" de uma vez.
alter table achievements add column visto boolean not null default true;
alter table achievements alter column visto set default false;
