/** Conteúdo do tutorial de boas-vindas e da página Ajuda. Os links apontam para páginas do app (conferidos nos testes). */

export type Passo = { titulo: string; texto: string; link?: { rotulo: string; href: string } }

/** Tutorial: o caminho de uma semana de estudo, em poucos passos. Aparece uma vez para contas novas e pode ser revisto na Ajuda. */
export const PASSOS_TUTORIAL: readonly Passo[] = [
  { titulo: 'Bem-vindo ao Residência OS', texto: 'O app tem 5 seções: Hoje, Agenda, Questões, Matérias e Progresso. Dentro de cada uma, as abas no topo mostram o resto. Em 1 minuto, o caminho do dia a dia; dá para pular e rever depois em Ajuda.' },
  { titulo: '1. Seus assuntos', texto: 'Toda conta começa vazia. Em Agenda → Plano, importe o seu cronograma (texto ou PDF, com "# SEMANA 1", "## Disciplina" e os assuntos) ou adicione assuntos em Matérias → Assuntos.',
    link: { rotulo: 'Importar cronograma', href: '/importar' } },
  { titulo: '2. Quanto tempo você tem', texto: 'Sem horários de relógio: em Agenda → Meu tempo você diz quanto tempo tem para estudar em cada dia. A escala mudou? É um toque por dia.',
    link: { rotulo: 'Abrir Meu tempo', href: '/semana' } },
  { titulo: '3. O plano se monta sozinho', texto: 'Em Agenda → Plano, "Gerar ou atualizar cronograma" distribui os assuntos pelo tempo de cada dia. Atrasou? "Reorganizar atrasadas" mostra uma prévia antes de mudar.',
    link: { rotulo: 'Ver o cronograma', href: '/cronograma' } },
  { titulo: '4. Todo dia, comece por Hoje', texto: 'A seção Hoje mostra só o que cabe no tempo de hoje. Conclua com um toque (ou deslize para a direita), adie deslizando para a esquerda e use o cronômetro se quiser contar o tempo real.' },
  { titulo: '5. Revisões automáticas', texto: 'Ao concluir um assunto, as revisões D1, D7, D30 e D60 são criadas sozinhas. Os intervalos mudam em Configurações e podem se ajustar ao seu acerto.',
    link: { rotulo: 'Ver revisões', href: '/revisoes' } },
  { titulo: '6. Questões, provas e erros', texto: 'Em Questões → Banco, importe questões (PDF, .docx ou pacote .json) e organize por assunto; em Praticar, escolha o que estudar e responda uma por vez, com a resposta na hora. Em Provas, faça provas inteiras; em Erros, transforme os erros em revisão no Caderno de Erros. O Desempenho mostra onde focar.',
    link: { rotulo: 'Registrar questões', href: '/questoes' } },
  { titulo: '7. Sua agenda', texto: 'Internato, plantões e academia vão em Agenda → Compromissos. Eles não viram tarefa de estudo: aparecem junto no Calendário e sugerem quanto estudar em cada dia.',
    link: { rotulo: 'Abrir a agenda', href: '/agenda' } },
  { titulo: 'Pronto!', texto: 'Dúvidas? A Ajuda (no rodapé do menu ou no "?" do topo, no celular) responde as perguntas mais comuns e tem este tutorial de novo.' },
]

export type Pergunta = { p: string; r: string; links?: { rotulo: string; href: string }[] }
export type Secao = { titulo: string; perguntas: Pergunta[] }

export const FAQ: readonly Secao[] = [
  { titulo: 'Começando', perguntas: [
    { p: 'Onde fica cada coisa?', r: 'São 5 seções, no menu (ou na barra de baixo, no celular), e cada uma tem abas no topo. Hoje: o que fazer hoje e as revisões. Agenda: calendário, plano de estudo, o seu tempo de cada dia e os compromissos (internato, plantões, academia). Questões: praticar, o banco de questões (importar e organizar), provas, registrar questões feitas fora e o caderno de erros. Matérias: disciplinas e assuntos. Progresso: desempenho, metas e simulados. Configurações e Ajuda ficam no rodapé do menu (no celular, na engrenagem e no "?" do topo).' },
    { p: 'Por onde eu começo?', r: 'Coloque seus assuntos (Agenda → Plano → Importar cronograma, ou Matérias → Assuntos), diga quanto tempo tem em cada dia em Agenda → Meu tempo e toque em "Gerar ou atualizar cronograma". Depois disso, o dia a dia é pela seção Hoje.',
      links: [{ rotulo: 'Importar cronograma', href: '/importar' }, { rotulo: 'Meu tempo', href: '/semana' }] },
    { p: 'Qual formato o importador de cronograma aceita?', r: 'Texto colado ou PDF, organizado por semanas: uma linha "# SEMANA 1", depois "## Nome da disciplina" e os assuntos embaixo, um por linha. A ordem da importação vira a ordem de estudo.', links: [{ rotulo: 'Importar cronograma', href: '/importar' }] },
    { p: 'Dá para instalar no celular como aplicativo?', r: 'Sim. Abra o app no navegador do celular e use "Adicionar à tela inicial" (Chrome: menu ⋮; Safari: botão Compartilhar). O passo a passo também está em Configurações → Instalar no celular.', links: [{ rotulo: 'Configurações', href: '/configuracoes' }] },
    { p: 'Como eu revejo o tutorial?', r: 'No topo desta página, em "Rever o tutorial".' },
  ] },
  { titulo: 'Planejamento', perguntas: [
    { p: 'Por que o app não usa horários?', r: 'Porque a escala do internato muda toda semana. Você informa quanto tempo tem em cada dia e o app monta o que cabe nesse tempo, na ordem certa, sem tarefas em horários irreais.' },
    { p: 'Qual a diferença entre Meu tempo e Compromissos?', r: 'Meu tempo é o tempo de ESTUDO de cada dia: é o que o cronograma usa. Compromissos guarda internato, plantões, academia e compromissos com horário; ela não entra no estudo, só aparece junto no Calendário e sugere quanto estudar (metade do tempo livre, até 4 h). A sugestão só vale se você tocar em "usar".',
      links: [{ rotulo: 'Meu tempo', href: '/semana' }, { rotulo: 'Compromissos', href: '/agenda' }] },
    { p: 'Mudei o tempo de um dia. O cronograma muda sozinho?', r: 'O tempo de hoje ajusta na hora a lista de Hoje. Para os outros dias, o app avisa que o plano ficou desatualizado; toque em "Atualizar meu cronograma" (Meu tempo ou Plano de estudo).' },
    { p: 'O que acontece com uma tarefa que eu não fiz?', r: 'No fim do dia ela fica "Atrasada", sem cobrança. Em Hoje, "Reorganizar atrasadas" mostra uma prévia e redistribui pelos próximos dias. Você também pode adiar uma tarefa (deslizando para a esquerda) e desfazer em até 8 segundos.' },
    { p: 'Sobrou tempo hoje. Posso adiantar?', r: 'Sim. Quando você informa o tempo de hoje e tudo já cabe, Hoje oferece trazer tarefas dos próximos dias.' },
    { p: 'Como coloco a escala do internato de uma vez?', r: 'Em Agenda → Compromissos, em "Escala em texto", cole algo como "seg 7-13 Enfermaria; ter 19-7 PS; qua a sex 7-13 Ambulatório". Você vê a prévia antes de salvar. "Copiar a semana anterior" repete os horários de um dia só.', links: [{ rotulo: 'Compromissos', href: '/agenda' }] },
    { p: 'Como deixo livre um horário da agenda só num dia?', r: 'No Calendário (ou na semana de Compromissos), toque no bloco do compromisso. "Liberar este horário" deixa aquele dia livre; num horário de "toda semana", só aquela data é liberada e as outras semanas continuam. Também dá para "Excluir de todas as semanas". O tempo livre do dia é recalculado na hora e o aviso tem "Desfazer" por alguns segundos.', links: [{ rotulo: 'Calendário', href: '/calendario' }] },
    { p: 'Como excluo uma tarefa de estudo do calendário?', r: 'Toque na tarefa no Calendário e use "Excluir" no painel que abre. Excluir uma revisão remove a revisão; se preferir não perder o estudo, use "Adiar 1 dia" ou "Mover para esta data".', links: [{ rotulo: 'Calendário', href: '/calendario' }] },
    { p: 'Coloquei uma escala nova e não quero que fique duplicada. Como substituo a antiga?', r: 'Em Agenda → Compromissos, vá para a semana certa. Se ela já tiver horários de um dia só, a "Escala em texto" e o "Copiar a semana anterior" oferecem "Substituir": os horários de um dia só daquela semana saem e os novos entram no lugar, tudo de uma vez (dá para ver antes o que sai). Os de "toda semana", como a academia, ficam. Mesmo sem substituir, o app não repete um horário igual (mesmo dia, horário e nome).', links: [{ rotulo: 'Compromissos', href: '/agenda' }] },
  ] },
  { titulo: 'Estudo e revisões', perguntas: [
    { p: 'Como funcionam as revisões?', r: 'Ao concluir um assunto, o app cria as revisões nos intervalos de Configurações (padrão: 1, 7, 30 e 60 dias). Com o ajuste pelo desempenho ligado, acerto abaixo de 60% ou dificuldade alta encurta a próxima revisão e 80% ou mais alonga.', links: [{ rotulo: 'Revisões', href: '/revisoes' }, { rotulo: 'Configurações', href: '/configuracoes' }] },
    { p: 'O que são as etapas de um assunto?', r: 'Um checklist do que fazer no estudo (ler, resumo, questões...). Cada revisão tem o seu próprio mini-checklist. Em Conteúdos dá para aplicar etapas em lote e desfazer o último lote por 24 horas.', links: [{ rotulo: 'Conteúdos', href: '/conteudos' }] },
    { p: 'Para que serve o cronômetro?', r: 'Para contar o tempo real de uma tarefa ou de um estudo livre. Ele fica numa barra fixa em qualquer página, continua certo se você trocar de aparelho e, ao finalizar, você confirma os minutos antes de gravar.' },
    { p: 'Como organizo as disciplinas pelas 5 áreas da prova?', r: 'Em Matérias → Disciplinas, "Organizar por áreas" sugere a área de cada disciplina pelo nome (Clínica, Cirurgia, Pediatria, GO, Preventiva); você confere antes de salvar. O Desempenho passa a mostrar o acerto por área.', links: [{ rotulo: 'Disciplinas', href: '/disciplinas' }] },
  ] },
  { titulo: 'Questões, provas e erros', perguntas: [
    { p: 'Como registro questões?', r: 'Em Questões, escolha a disciplina ou o assunto, informe o total e os acertos. Se houver uma revisão pendente daquele assunto, a etapa "Fazer N questões" é marcada sozinha.', links: [{ rotulo: 'Questões', href: '/questoes' }] },
    { p: 'Como faço uma prova inteira no app?', r: 'Em Provas, importe o arquivo .docx (cada questão começando com "QUESTÃO 1" e as alternativas com "A)", "B)"...), cole o gabarito e comece. As respostas são salvas a cada toque e você pode parar e continuar depois, até em outro aparelho.', links: [{ rotulo: 'Provas', href: '/provas' }] },
    { p: 'O que vai para o Caderno de Erros depois da prova?', r: 'As questões que você errou, as que deixou em branco e as que acertou marcando "chutei". Elas entram como "Motivo a definir"; na correção (ou no próprio caderno) você escolhe o motivo e a disciplina.', links: [{ rotulo: 'Caderno de Erros', href: '/caderno-de-erros' }] },
    { p: 'A prova funciona sem internet?', r: 'As respostas ficam guardadas no aparelho e são enviadas quando a conexão volta (o topo da prova mostra quantas faltam). Para entregar a prova, é preciso estar conectado. O resto do app precisa de internet.' },
    { p: 'Como funciona o Banco de questões?', r: 'Você importa questões avulsas (PDF ou .docx no formato "Questão 1", alternativas "A." ou "A)" e o gabarito no fim, ou um pacote .json) e elas ficam guardadas com área, disciplina, assunto, banca e ano. Elas ficam na aba Banco (Questões → Banco), onde você importa, confere, dá o assunto e exclui. Para estudar, use a aba Praticar (ou o atalho "Praticar" de uma disciplina ou de um assunto): uma questão por vez, com a correção na hora. Cada resposta já entra no Desempenho, no XP e, se errou, no Caderno de Erros.', links: [{ rotulo: 'Banco', href: '/banco/questoes' }, { rotulo: 'Praticar', href: '/banco' }] },
    { p: 'Praticar ou montar lista?', r: 'Praticar é para estudar: uma questão por vez, você vê na hora se acertou (com o comentário, quando houver) e pode parar quando quiser; vêm primeiro as que você nunca fez, depois as que errou. Montar lista é para treinar como prova: o app sorteia a quantidade escolhida, você responde tudo com cronômetro e a correção vem só no fim.', links: [{ rotulo: 'Praticar', href: '/banco' }] },
    { p: 'Como coloco o assunto das questões do banco?', r: 'Ao importar, na prévia: escolha um assunto para todas, deixe o app sugerir pelo texto (ele procura o nome dos seus assuntos de Matérias no enunciado) ou mude uma por uma em "Ver as questões". Depois, na aba Banco: marque várias questões e use "Salvar nas marcadas"; "Sugerir pelo texto" faz isso sozinho com as que estão sem assunto (o filtro de assunto tem "Sem assunto" para achar as que faltam). Para corrigir uma só, abra a questão e use "Mudar assunto". Escolhendo um assunto de Matérias, o resultado entra no Desempenho daquele assunto.', links: [{ rotulo: 'Banco', href: '/banco/questoes' }, { rotulo: 'Assuntos', href: '/conteudos' }] },
    { p: 'O que é "Ligar assuntos"?', r: 'Aparece na aba Banco quando há questões com um nome de assunto que não está ligado a um assunto seu de Matérias (por exemplo, questões do banco geral com "Via aérea" quando o seu assunto se chama "Via aérea difícil"). Sem a ligação, elas não contam no Desempenho por assunto. Escolha o assunto de Matérias (o app já deixa o de nome mais parecido escolhido) ou crie um com aquele nome, e clique em Ligar: todas as questões com aquele nome vão juntas.', links: [{ rotulo: 'Banco', href: '/banco/questoes' }] },
    { p: 'De onde vêm as questões marcadas "banco geral"?', r: 'São questões que a administração do app publica para todas as contas. Elas entram sozinhas no seu banco quando você abre Praticar ou Banco, com enunciado, alternativas e gabarito (sem comentários), e funcionam como as suas: contam no Desempenho, vão para o Caderno de Erros e você pode mudar o assunto. Se o gabarito ou o enunciado for corrigido, a correção chega para você sem apagar o seu histórico nem o assunto que você escolheu. Se você já tinha a mesma questão, ela não duplica. Pode excluir as que não quiser; elas não voltam sozinhas, mas o Banco mostra "Trazer de volta".', links: [{ rotulo: 'Banco', href: '/banco/questoes' }] },
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
    { p: 'Como apago tudo e começo do zero?', r: 'Em Configurações, no fim da página, "Apagar tudo e começar do zero" apaga todas as informações da conta (disciplinas, assuntos, cronograma, revisões, questões, provas, banco de questões, erros, simulados, metas, compromissos, XP, conquistas e figuras) e volta as configurações ao padrão. Ficam só o e-mail e a senha. Não dá para desfazer: baixe o backup antes, em Configurações → Meus dados, se quiser guardar uma cópia.', links: [{ rotulo: 'Configurações', href: '/configuracoes' }] },
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
