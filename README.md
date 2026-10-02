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
40. Exportar dados: backup completo (JSON) e planilhas CSV (assuntos, questões, caderno de erros, simulados) em Configurações → Meus dados. Sem migração.
41. O atraso voltou a valer só no fim do dia (a tarefa fica "Atrasada" quando o dia dela termina), como antes do atraso por horário.
42. Lembrete diário por e-mail (Resend + agendador da Vercel): rode `supabase/migrations/0015_lembretes_email.sql` e configure as variáveis (veja o final do DEPLOY.md).
43. Página /diagnostico (login): mostra se o servidor enxerga as variáveis (sem revelar valores) e qual commit está no ar.
44. Endurecimento: unpdf 1.x (corrige 6 vulnerabilidades de dependência) e cabeçalhos de segurança HTTP.
45. Tablet/celular: lista "Hoje" no Início, alvos de toque de 44 px e mais espaço entre botões, calendário em 2 colunas no tablet, lateral só a partir de 1024 px, teclado numérico. Sem migração.
46. Calendário no celular: mês com pontinhos coloridos e lista do dia embaixo; controle de visão (Dia/Semana/Mês) em um bloco; título "Outubro de 2026".
47. Lembrete por e-mail: se o envio for recusado por causa do destinatário (modo de teste do Resend), a conta é desligada sozinha e mostra o motivo. Rode `supabase/migrations/0016_lembrete_aviso.sql`.
48. Questões: atalhos de quantidade, resumo ao vivo (erros e %) e detalhes recolhidos; Caderno de erros: motivo em botões; formulário ao lado do histórico no tablet deitado.
49. Questões do dia: cada bloco tem UM assunto (rodízio dentro da semana), em vez de listar vários.
50. Planejamento por TEMPO DISPONÍVEL (sem horários): Minha semana vira "quanto tempo tenho em cada dia"; Início tem "Quanto tempo você tem hoje?". Rode `supabase/migrations/0017_tempo_disponivel.sql` ANTES de publicar.
51. XP equilibrado, XP devolvido ao excluir, tempo das questões nas horas estudadas e questões/simulado levam ao registro. Rode `supabase/migrations/0018_xp_equilibrado.sql` ANTES de publicar.
52. Títulos por nível (Calouro → Professor Titular) e ranking Ferro → Desafiante por % de assuntos concluídos, com aviso de promoção. Rode `supabase/migrations/0019_rank_titulos.sql` (o app funciona sem ela, mas sem o aviso de promoção).
53. Cada revisão (D1, D7...) tem o SEU mini-checklist, criado desmarcado. As etapas do assunto ficam só no estudo. Rode `supabase/migrations/0020_revisao_etapas.sql` (sem ela o app funciona, mas sem os mini-checklists).
54. Plano que acompanha a semana: Reorganizar atrasadas (com prévia), Adiantar tarefas quando sobra tempo, lembrete semanal e aviso de cronograma desatualizado. Rode `supabase/migrations/0021_plano_vivo.sql` (sem ela o app funciona, mas sem esses recursos).
55. "Atualizar cronograma" não duplica mais um estudo atrasado (o assunto replanejado levava a tarefa antiga junto). Rode `supabase/migrations/0022_sem_duplicadas.sql` (também limpa as duplicatas que já existem).
56. Ritmo para a prova: compara o seu ritmo (assuntos concluídos por semana) com o necessário para terminar o estudo novo antes da reta final, no Início e no Cronograma. Sem SQL novo.
57. E-mail das 7h no modelo de tempo disponível: mesma ordem do painel Hoje, com duração, o que cabe no tempo de hoje e o que fica para depois; não é enviado sozinho em dia sem tempo de estudo. Sem SQL novo.
58. Ritmo para a prova sem alarme: rótulos neutros, projeção só perto do prazo, meta pequena da semana, linha discreta no Início e opção de ocultar em Configurações. Rode `supabase/migrations/0023_ritmo_modo.sql` (sem ela o app funciona no modo "resumo", mas a escolha não salva).
59. Pequenos ajustes: Registrar questões marca sozinho "Fazer N questões" na revisão pendente do assunto; o tempo das revisões entra nas horas estudadas; calendário em duas colunas no tablet deitado e gestos de deslizar (concluir/adiar). Rode `supabase/migrations/0024_ajustes_pequenos.sql` (os gestos e o painel funcionam sem ela).
60. Cronômetro de estudo: um por pessoa, guardado no servidor; barra fixa em qualquer página; ao finalizar você confirma os minutos e o app conclui pelo mesmo caminho de sempre (assunto, revisão) com o tempo real, ou abre o registro de questões/simulado/revisão com o tempo preenchido. Rode `supabase/migrations/0025_cronometro.sql` ANTES de publicar (sem ela o app funciona, só sem o cronômetro).
61. Menu lateral recolhível: o botão ‹ recolhe o menu para uma faixa fina com ☰ (que abre o menu por cima); a escolha fica guardada neste aparelho. Sem SQL.
62. Calendário no tablet deitado: no mês, os dias viram pontinhos (como no celular) e o painel da direita lista as tarefas do dia selecionado (corrige as células espremidas). Sem SQL.
