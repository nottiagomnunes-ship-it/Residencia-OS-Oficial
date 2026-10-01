-- permite desligar o ajuste adaptativo dos intervalos (Configurações, fase futura)
alter table profiles add column adaptive_reviews boolean not null default true;
