# Residência OS — Fase 7 (simulados, metas, gamificação, configurações)
1. Crie um projeto no Supabase e rode `supabase/migrations/0001_init.sql` no SQL Editor.
2. (Dev) Em Authentication → Providers → Email, desative "Confirm email" para entrar direto após o cadastro.
3. `cp .env.example .env.local` e preencha URL e anon key.
4. `npm install && npm run dev` → http://localhost:3000
5. Rode também `supabase/migrations/0002_topics_unique.sql` (necessário para importar o catálogo).
6. Rode `supabase/migrations/0003_adaptive_reviews.sql`. Testes das regras: `npm test`.
7. Rode `supabase/migrations/0004_planned_auto.sql`.
8. Rode `supabase/migrations/0005_simulado_questoes.sql`.
9. Rode `supabase/migrations/0006_config_limites.sql`.
10. Importar cronograma (texto/PDF): `npm install` traz a dependência `unpdf`; a tela fica em /importar.
11. Etapas por assunto: rode `supabase/migrations/0007_topic_tasks.sql`; a página de cada assunto fica em /conteudos/[id].
12. Aviso de conquistas novas: rode `supabase/migrations/0008_achievements_visto.sql`.
13. Minha semana (horários ocupados): rode `supabase/migrations/0009_compromissos.sql`; a tela fica em /semana.
14. Compromissos de Minha semana aparecem em cinza no Calendário e no Cronograma (sem migração nova).
15. Aviso de conflito de horário ao criar/mover/adiar tarefas sobre um compromisso (sem migração).
16. Aviso de conflito também entre tarefas; o gerador de cronograma trata tarefas manuais com horário como ocupadas (sem migração).
17. Editar tarefa (título, horário, duração, nº de questões) no painel do calendário, com aviso de conflito (sem migração).
18. Configurações → "Reiniciar configurações" (volta ao padrão e reabre o onboarding, sem apagar estudo). O onboarding agora nunca apaga disciplinas.
19. Ordem de estudo na importação (Semana/Dia/Bloco): rode `supabase/migrations/0010_ordem_estudo.sql`.
20. Ritmo por semana: cada grupo "Semana N" ocupa 7 dias a partir de hoje, com os assuntos espaçados (sem migração nova).
21. Semanas do plano agora são de segunda a domingo (Semana 1 = semana corrente, ou a próxima se restarem menos de 3 dias úteis).
22. Questões do dia agora focam nas revisões do dia e nos assuntos estudados na semana (sem migração).
23. Questões do dia: assuntos fracos em dias alternados e atalho "Registrar questões" no painel da tarefa (sem migração).
24. Padrões de etapas (lista de opções, conjunto padrão, salvar item como padrão) e edição do texto das etapas: rode `supabase/migrations/0011_etapa_modelos.sql`.
25. Aplicar etapas em lote (por semana, disciplina ou todos sem etapas) na página Conteúdos (sem migração nova).
26. Desfazer o último lote de etapas aplicado em Conteúdos: rode `supabase/migrations/0012_lote_etapas.sql`.
27. O "desfazer último lote" vale por 24 horas depois da aplicação (sem migração).
28. Publicação na Vercel: veja DEPLOY.md.
29. PWA (instalável, ícone, tela offline) e menu "Mais" no celular. Sem migração nova.
30. Celular: painel da tarefa acima da barra inferior, etapas que quebram linha e tabelas em formato de cartões.
31. Celular: corrige a página que "dava zoom out" por causa de campos largos (min-width nas grades, minimum-scale 1).
32. Tarefas ficam "atrasadas" quando o horário marcado termina sem conclusão (Calendário e Cronograma). Sem migração.
32. Tarefa com horário vira "atrasada" quando o horário de término passa sem concluir (Calendário e Cronograma; sem migração).
33. Etapas (subtópicos) dentro do painel da tarefa no Calendário, com contador nos cartões (sem migração).
34. Cadastro em página própria (/cadastro), login só com "Entrar", mensagens de erro em português (sem migração).
35. Toda conta nova começa com 0 assuntos: o onboarding não carrega mais o catálogo sugerido (ele continua disponível, só se você pedir, em Conteúdos).
36. Gravações "tudo ou nada": rode `supabase/migrations/0013_funcoes_atomicas.sql` ANTES de publicar esta versão (concluir assunto/revisão, gerar cronograma e registrar questões).
37. Importar plano e "Só limpar" também são "tudo ou nada": rode `supabase/migrations/0014_importar_plano_atomico.sql` ANTES de publicar esta versão.
38. "Esqueci minha senha" (/recuperar-senha, /auth/confirm, /redefinir-senha): veja o final do DEPLOY.md. Sem migração.
39. Recuperação de senha sem editar o modelo do e-mail: o link traz a sessão no "#" e a página /auth/recuperar a grava (funciona em qualquer aparelho).
