-- lembrete diário por e-mail (resumo das revisões e tarefas do dia). Desligado por padrão.
alter table profiles
  add column lembrete_email boolean not null default false,
  add column lembrete_ultimo date;   -- último dia em que o resumo foi enviado (evita e-mail repetido se o agendador rodar duas vezes)
