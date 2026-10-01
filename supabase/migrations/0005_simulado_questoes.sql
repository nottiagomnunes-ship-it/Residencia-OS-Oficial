-- questões de um simulado ficam ligadas a ele: excluir o simulado remove as questões do desempenho
alter table question_sets add column mock_exam_id uuid references mock_exams on delete cascade;
create index on question_sets (mock_exam_id);
