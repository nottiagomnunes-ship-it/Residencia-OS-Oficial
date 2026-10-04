/** Conteúdo do tutorial de boas-vindas e da página Ajuda. Os links apontam para páginas do app (conferidos nos testes). */

export type Passo = { titulo: string; texto: string; link?: { rotulo: string; href: string } }

/** Tutorial: o caminho de uma semana de estudo, em poucos passos. Aparece uma vez para contas novas e pode ser revisto na Ajuda. */
export const PASSOS_TUTORIAL: readonly Passo[] = [
  { titulo: 'Bem-vindo ao Residência OS', texto: 'Em 1 minuto, o caminho para usar o app no dia a dia do internato. Você pode pular agora e rever quando quiser em Ajuda.' },
  { titulo: '1. Seus assuntos', texto: 'Toda conta começa vazia. Importe o seu cronograma (texto ou PDF, com "# SEMANA 1", "## Disciplina" e os assuntos) ou adicione assuntos em Conteúdos.',
    link: { rotulo: 'Importar cronograma', href: '/importar' } },
  { titulo: '2. Quanto tempo você tem', texto: 'Sem horários de relógio: em Minha semana você diz quanto tempo tem para estudar em cada dia. A escala mudou? É um toque por dia.',
    link: { rotulo: 'Abrir Minha semana', href: '/semana' } },
  { titulo: '3. O plano se monta sozinho', texto: 'Em Meu Cronograma, "Gerar ou atualizar cronograma" distribui os assuntos pelo tempo de cada dia. Atrasou? "Reorganizar atrasadas" mostra uma prévia antes de mudar.',
    link: { rotulo: 'Ver o cronograma', href: '/cronograma' } },
  { titulo: '4. Todo dia, comece pelo Início', texto: 'O painel Hoje mostra só o que cabe no tempo de hoje. Conclua com um toque (ou deslize para a direita), adie deslizando para a esquerda e use o cronômetro se quiser contar o tempo real.' },
  { titulo: '5. Revisões automáticas', texto: 'Ao concluir um assunto, as revisões D1, D7, D30 e D60 são criadas sozinhas. Os intervalos mudam em Configurações e podem se ajustar ao seu acerto.',
    link: { rotulo: 'Ver revisões', href: '/revisoes' } },
  { titulo: '6. Questões, provas e erros', texto: 'Registre blocos de questões, monte listas no Banco de questões (importando PDF, .docx ou um pacote .json), faça provas inteiras em Provas e transforme os erros em revisão no Caderno de Erros. O Desempenho mostra onde focar.',
    link: { rotulo: 'Registrar questões', href: '/questoes' } },
  { titulo: '7. Sua agenda', texto: 'Internato, plantões e academia vão na Agenda pessoal. Eles não viram tarefa de estudo: aparecem junto no Calendário e sugerem quanto estudar em cada dia.',
    link: { rotulo: 'Abrir a agenda', href: '/agenda' } },
  { titulo: 'Pronto!', texto: 'Dúvidas? A página Ajuda, no fim do menu, responde as perguntas mais comuns e tem este tutorial de novo.' },
]

export type Pergunta = { p: string; r: string; links?: { rotulo: string; href: string }[] }
export type Secao = { titulo: string; perguntas: Pergunta[] }

export const FAQ: readonly Secao[] = [
  { titulo: 'Começando', perguntas: [
    { p: 'Por onde eu começo?', r: 'Coloque seus assuntos (importando o cronograma ou em Conteúdos), diga quanto tempo tem em cada dia em Minha semana e toque em "Gerar ou atualizar cronograma". Depois disso, o dia a dia é pelo Início.',
      links: [{ rotulo: 'Importar cronograma', href: '/importar' }, { rotulo: 'Minha semana', href: '/semana' }] },
    { p: 'Qual formato o importador de cronograma aceita?', r: 'Texto colado ou PDF, organizado por semanas: uma linha "# SEMANA 1", depois "## Nome da disciplina" e os assuntos embaixo, um por linha. A ordem da importação vira a ordem de estudo.', links: [{ rotulo: 'Importar cronograma', href: '/importar' }] },
    { p: 'Dá para instalar no celular como aplicativo?', r: 'Sim. Abra o app no navegador do celular e use "Adicionar à tela inicial" (Chrome: menu ⋮; Safari: botão Compartilhar). O passo a passo também está em Configurações → Instalar no celular.', links: [{ rotulo: 'Configurações', href: '/configuracoes' }] },
    { p: 'Como eu revejo o tutorial?', r: 'No topo desta página, em "Rever o tutorial".' },
  ] },
  { titulo: 'Planejamento', perguntas: [
    { p: 'Por que o app não usa horários?', r: 'Porque a escala do internato muda toda semana. Você informa quanto tempo tem em cada dia e o app monta o que cabe nesse tempo, na ordem certa, sem tarefas em horários irreais.' },
    { p: 'Qual a diferença entre Minha semana e a Agenda pessoal?', r: 'Minha semana é o tempo de ESTUDO de cada dia: é o que o cronograma usa. A Agenda pessoal guarda internato, plantões, academia e compromissos com horário; ela não entra no estudo, só aparece junto no Calendário e sugere quanto estudar (metade do tempo livre, até 4 h). A sugestão só vale se você tocar em "usar".',
      links: [{ rotulo: 'Minha semana', href: '/semana' }, { rotulo: 'Agenda pessoal', href: '/agenda' }] },
    { p: 'Mudei o tempo de um dia. O cronograma muda sozinho?', r: 'O tempo de hoje ajusta na hora a lista do Início. Para os outros dias, o app avisa que o plano ficou desatualizado; toque em "Atualizar meu cronograma" (Minha semana ou Meu Cronograma).' },
    { p: 'O que acontece com uma tarefa que eu não fiz?', r: 'No fim do dia ela fica "Atrasada", sem cobrança. No Início, "Reorganizar atrasadas" mostra uma prévia e redistribui pelos próximos dias. Você também pode adiar uma tarefa (deslizando para a esquerda) e desfazer em até 8 segundos.' },
    { p: 'Sobrou tempo hoje. Posso adiantar?', r: 'Sim. Quando você informa o tempo de hoje e tudo já cabe, o Início oferece trazer tarefas dos próximos dias.' },
    { p: 'Como coloco a escala do internato de uma vez?', r: 'Na Agenda pessoal, em "Escala em texto", cole algo como "seg 7-13 Enfermaria; ter 19-7 PS; qua a sex 7-13 Ambulatório". Você vê a prévia antes de salvar. "Copiar a semana anterior" repete os horários de um dia só.', links: [{ rotulo: 'Agenda pessoal', href: '/agenda' }] },
    { p: 'Como deixo livre um horário da agenda só num dia?', r: 'No Calendário (ou na semana da Agenda pessoal), toque no bloco do compromisso. "Liberar este horário" deixa aquele dia livre; num horário de "toda semana", só aquela data é liberada e as outras semanas continuam. Também dá para "Excluir de todas as semanas". O tempo livre do dia é recalculado na hora e o aviso tem "Desfazer" por alguns segundos.', links: [{ rotulo: 'Calendário', href: '/calendario' }] },
    { p: 'Como excluo uma tarefa de estudo do calendário?', r: 'Toque na tarefa no Calendário e use "Excluir" no painel que abre. Excluir uma revisão remove a revisão; se preferir não perder o estudo, use "Adiar 1 dia" ou "Mover para esta data".', links: [{ rotulo: 'Calendário', href: '/calendario' }] },
    { p: 'Coloquei uma escala nova e não quero que fique duplicada. Como substituo a antiga?', r: 'Na Agenda pessoal, vá para a semana certa. Se ela já tiver horários de um dia só, a "Escala em texto" e o "Copiar a semana anterior" oferecem "Substituir": os horários de um dia só daquela semana saem e os novos entram no lugar, tudo de uma vez (dá para ver antes o que sai). Os de "toda semana", como a academia, ficam. Mesmo sem substituir, o app não repete um horário igual (mesmo dia, horário e nome).', links: [{ rotulo: 'Agenda pessoal', href: '/agenda' }] },
  ] },
  { titulo: 'Estudo e revisões', perguntas: [
    { p: 'Como funcionam as revisões?', r: 'Ao concluir um assunto, o app cria as revisões nos intervalos de Configurações (padrão: 1, 7, 30 e 60 dias). Com o ajuste pelo desempenho ligado, acerto abaixo de 60% ou dificuldade alta encurta a próxima revisão e 80% ou mais alonga.', links: [{ rotulo: 'Revisões', href: '/revisoes' }, { rotulo: 'Configurações', href: '/configuracoes' }] },
    { p: 'O que são as etapas de um assunto?', r: 'Um checklist do que fazer no estudo (ler, resumo, questões...). Cada revisão tem o seu próprio mini-checklist. Em Conteúdos dá para aplicar etapas em lote e desfazer o último lote por 24 horas.', links: [{ rotulo: 'Conteúdos', href: '/conteudos' }] },
    { p: 'Para que serve o cronômetro?', r: 'Para contar o tempo real de uma tarefa ou de um estudo livre. Ele fica numa barra fixa em qualquer página, continua certo se você trocar de aparelho e, ao finalizar, você confirma os minutos antes de gravar.' },
    { p: 'Como organizo as disciplinas pelas 5 áreas da prova?', r: 'Em Disciplinas, "Organizar por áreas" sugere a área de cada disciplina pelo nome (Clínica, Cirurgia, Pediatria, GO, Preventiva); você confere antes de salvar. O Desempenho passa a mostrar o acerto por área.', links: [{ rotulo: 'Disciplinas', href: '/disciplinas' }] },
  ] },
  { titulo: 'Questões, provas e erros', perguntas: [
    { p: 'Como registro questões?', r: 'Em Questões, escolha a disciplina ou o assunto, informe o total e os acertos. Se houver uma revisão pendente daquele assunto, a etapa "Fazer N questões" é marcada sozinha.', links: [{ rotulo: 'Questões', href: '/questoes' }] },
    { p: 'Como faço uma prova inteira no app?', r: 'Em Provas, importe o arquivo .docx (cada questão começando com "QUESTÃO 1" e as alternativas com "A)", "B)"...), cole o gabarito e comece. As respostas são salvas a cada toque e você pode parar e continuar depois, até em outro aparelho.', links: [{ rotulo: 'Provas', href: '/provas' }] },
    { p: 'O que vai para o Caderno de Erros depois da prova?', r: 'As questões que você errou, as que deixou em branco e as que acertou marcando "chutei". Elas entram como "Motivo a definir"; na correção (ou no próprio caderno) você escolhe o motivo e a disciplina.', links: [{ rotulo: 'Caderno de Erros', href: '/caderno-de-erros' }] },
    { p: 'A prova funciona sem internet?', r: 'As respostas ficam guardadas no aparelho e são enviadas quando a conexão volta (o topo da prova mostra quantas faltam). Para entregar a prova, é preciso estar conectado. O resto do app precisa de internet.' },
    { p: 'Como funciona o Banco de questões?', r: 'Você importa questões avulsas (PDF ou .docx no formato "Questão 1", alternativas "A." ou "A)" e o gabarito no fim, ou um pacote .json) e elas ficam guardadas com área, disciplina, assunto, banca e ano. Depois, "Montar lista" sorteia questões pelos filtros (por exemplo, 10 de Anestesiologia que você nunca fez) e abre a lista na mesma tela das provas. Ao entregar, os erros vão para o Caderno de Erros e o resultado entra no Desempenho da disciplina.', links: [{ rotulo: 'Banco de questões', href: '/banco' }] },
    { p: 'Se eu importar a mesma questão duas vezes, ela duplica?', r: 'Não. O app reconhece a questão pelo texto (sem ligar para acentos, maiúsculas e pontuação) e ignora as que já estão no banco. No fim da importação ele diz quantas eram novas e quantas já estavam lá.' },
    { p: 'Por que algumas questões do banco não entram nas listas?', r: 'Só entram questões com gabarito e não anuladas. Questões sem gabarito no arquivo, ou marcadas como anuladas, ficam no banco (aparecem com o aviso "sem gabarito" ou "anulada"), mas não são sorteadas.' },
    { p: 'O que quer dizer "gabarito sugerido pela IA"?', r: 'Num pacote .json, o gabarito pode vir marcado como sugerido por uma IA em vez de oficial. Ele vale para corrigir, mas a correção mostra o aviso "confira": pode haver erro, principalmente em questões ambíguas ou com condutas que mudaram.' },
    { p: 'As figuras do PDF entram no banco?', r: 'Não: do PDF o app lê só o texto. A prévia avisa quais questões parecem depender de uma figura. No .docx e no pacote .json as figuras entram normalmente.' },
    { p: 'Qual a diferença entre Simulados e Provas?', r: 'Em Simulados você só registra o resultado de uma prova feita fora do app. Em Provas você faz a prova aqui; ao corrigir, o resultado também aparece em Simulados.', links: [{ rotulo: 'Simulados', href: '/simulados' }] },
  ] },
  { titulo: 'Progresso', perguntas: [
    { p: 'Como ganho XP e subo de nível?', r: 'Estudo concluído, revisões, questões e simulados dão XP; a cada 500 XP você sobe um nível (de Calouro a Professor Titular). Excluir um registro devolve o XP dele, então o número é sempre justo.', links: [{ rotulo: 'Metas', href: '/metas' }] },
    { p: 'O que é o ranking de Ferro a Desafiante?', r: 'Mostra a porcentagem dos seus assuntos que já foram concluídos. Ele sobe conforme o plano anda, não por horas.' },
    { p: 'O que é o "Ritmo para a prova"?', r: 'Compara quantos assuntos você conclui por semana com o necessário para terminar antes da reta final. Ele usa rótulos neutros e pode ser ocultado em Configurações.', links: [{ rotulo: 'Configurações', href: '/configuracoes' }] },
  ] },
  { titulo: 'Conta e dados', perguntas: [
    { p: 'Esqueci minha senha.', r: 'Na tela de entrada, use "Esqueci minha senha" e siga o link que chega no seu e-mail.', links: [{ rotulo: 'Recuperar senha', href: '/recuperar-senha' }] },
    { p: 'Como faço backup dos meus dados?', r: 'Em Configurações → Meus dados: backup completo (arquivo JSON) e planilhas CSV. Para voltar um backup, use "Restaurar backup": o app mostra o que muda, pede para digitar RESTAURAR e permite desfazer.', links: [{ rotulo: 'Configurações', href: '/configuracoes' }] },
    { p: 'Reiniciar as configurações apaga meu estudo?', r: 'Não. "Reiniciar configurações" volta a data da prova, a rotina e os ajustes para o padrão e reabre o assistente inicial; assuntos, revisões, questões e erros continuam.' },
    { p: 'Posso receber um lembrete por e-mail?', r: 'Sim, se estiver disponível na sua conta: em Configurações → Lembretes por e-mail. O e-mail chega às 7h com o que cabe no tempo do dia e não é enviado em dia sem tempo de estudo.' },
    { p: 'Dá para aumentar o tamanho do texto?', r: 'Sim, em Configurações → Aparência. A escolha vale para todo o app neste aparelho.' },
  ] },
]

/** Minúsculas e sem acentos, para a busca achar "revisao" em "Revisão". */
const norm = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Busca nas perguntas e respostas (todas as palavras precisam aparecer). Sem busca, devolve tudo. Seções sem resultado somem. */
export function buscarNaAjuda(secoes: readonly Secao[], termo: string): Secao[] {
  // radical simples: "plantao" acha "plantões", "revisao" acha "revisões" (tira as duas últimas letras das palavras longas)
  const palavras = norm(termo).split(/\s+/).filter(w => w.length > 1).map(w => (w.length >= 5 ? w.slice(0, Math.max(4, w.length - 2)) : w))
  if (!palavras.length) return [...secoes]
  return secoes.map(s => ({ ...s, perguntas: s.perguntas.filter(q => { const t = norm(`${q.p} ${q.r} ${s.titulo}`); return palavras.every(w => t.includes(w)) }) }))
    .filter(s => s.perguntas.length)
}
