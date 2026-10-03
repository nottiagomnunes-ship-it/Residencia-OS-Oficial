-- As 5 grandes áreas da prova de residência, como um nível acima da disciplina: Cardiologia e Nefrologia continuam sendo disciplinas,
-- e cada uma pertence a uma área (Clínica Médica). Opcional: disciplina sem área simplesmente fica em "Sem área".
alter table disciplines add column area text check (area in ('clinica', 'cirurgia', 'pediatria', 'go', 'preventiva'));
