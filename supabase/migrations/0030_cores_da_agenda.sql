-- Cores da agenda pessoal escolhidas por você, por tipo ({"plantao": "#EC4899", ...}). Vazio = cores padrão.
-- Guardadas no perfil para valerem em todos os aparelhos. Pode ser executada mais de uma vez.
alter table profiles add column if not exists cores_agenda jsonb not null default '{}'::jsonb;
