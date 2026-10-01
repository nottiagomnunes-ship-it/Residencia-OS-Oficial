-- distingue data planejada pelo usuário (fixa) da gerada pelo cronograma automático
alter table topics add column planned_auto boolean not null default false;
