import { addDays, diffDays } from './review'
import { weekStart } from './calendar'
import { janelasDoDia, MIN_BLOCO, type Intervalo } from './compromissos'

export type Topico = { id: string; nome: string; disciplineId: string; prioridade: number; dificuldade: number; plannedDate?: string | null; reforco?: boolean; ordem?: number | null; grupo?: string | null }
export type Disc = { id: string; nome: string; peso: number }
export type Bloco = { tipo: 'estudo' | 'questoes' | 'simulado'; topic_id: string | null; titulo: string; data: string; duracao_min: number; qtd_questoes: number | null; hora_ini?: string; hora_fim?: string; ordem_dia?: number }
export type Entrada = {
  hoje: string; prova: string; diasDisponiveis: number[]; minutosDia: number; questoesDia: number
  disciplinas: Disc[]; topicos: Topico[]; fixos: Topico[]; reforcos?: Topico[]; minutosRevisaoPorDia: Record<string, number>
  janela?: { ini: number; fim: number }; ocupados?: Record<string, Intervalo[]>; folga?: number // horários livres (minutos desde 00:00)
  revisoesPorDia?: Record<string, { nome: string; id?: string }[]> // assuntos com revisão marcada em cada dia
  fracos?: { id: string; nome: string; disciplineId: string }[] // assuntos de desempenho mais fraco, por prioridade
  capacidadePorDia?: Record<string, number> // minutos de estudo informados para cada data (substituem o tempo padrão)
}

const dow = (d: string) => new Date(d + 'T00:00:00Z').getUTCDay()
const dias = (a: string, b: string) => Array.from({ length: diffDays(a, b) + 1 }, (_, i) => addDays(a, i))
const hhmm = (m: number) => `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`
const score = (t: Topico) => (4 - t.prioridade) * 3 + t.dificuldade
export const duracaoTopico = (t: Topico) => (t.reforco ? 45 : 60 + (t.dificuldade - 2) * 15)

/** Intercala disciplinas proporcionalmente ao peso (round-robin ponderado); dentro de cada uma, prioridade e dificuldade primeiro. */
export function ordemDeEstudo(disciplinas: Disc[], todos: Topico[]) {
  // assuntos com ordem definida pelo usuário (importação) vêm primeiro, na sequência dele; o resto segue o rodízio por peso
  const fixa = todos.filter(t => t.ordem != null).sort((a, b) => a.ordem! - b.ordem!), topicos = todos.filter(t => t.ordem == null)
  const fila = new Map(disciplinas.map(d => [d.id, topicos.filter(t => t.disciplineId === d.id).sort((a, b) => score(b) - score(a) || a.nome.localeCompare(b.nome))]))
  const atual = new Map(disciplinas.map(d => [d.id, 0]))
  const out: Topico[] = []
  for (;;) {
    const vivos = disciplinas.filter(d => fila.get(d.id)!.length)
    if (!vivos.length) return [...fixa, ...out]
    vivos.forEach(d => atual.set(d.id, atual.get(d.id)! + d.peso))
    const pick = vivos.reduce((a, b) => (atual.get(b.id)! > atual.get(a.id)! ? b : a))
    atual.set(pick.id, atual.get(pick.id)! - vivos.reduce((s, d) => s + d.peso, 0))
    out.push(fila.get(pick.id)!.shift()!)
  }
}

const janelasDe = (e: Entrada, d: string) => janelasDoDia(e.janela?.ini ?? 480, e.janela?.fim ?? 1440, e.ocupados?.[d] ?? [], e.folga ?? 0)
const GAP = 15

/** Encaixa cada bloco na primeira janela livre em que cabe; se nenhuma comporta, encolhe na maior (mín. 20 min) ou fica sem horário. */
function colocar(blocos: Bloco[], e: Entrada) {
  const ord = [...blocos].sort((a, b) => a.data.localeCompare(b.data)), jan = new Map<string, [number, number][]>()
  for (const b of ord) {
    const l = jan.get(b.data) ?? janelasDe(e, b.data); jan.set(b.data, l)
    let i = l.findIndex(([x, y]) => y - x >= b.duracao_min)
    if (i < 0) {
      i = l.reduce((m, w, k) => (w[1] - w[0] > (l[m]?.[1] ?? 0) - (l[m]?.[0] ?? 0) ? k : m), 0)
      if (!l[i] || l[i][1] - l[i][0] < 20) continue
      b.duracao_min = l[i][1] - l[i][0]
    }
    const [x, y] = l[i]
    b.hora_ini = hhmm(x); b.hora_fim = hhmm(x + b.duracao_min); l[i] = [x + b.duracao_min + GAP, y]
  }
  return ord
}

/** Dias finais antes da prova reservados a questões e simulados: 20% do período que resta, no máximo 21. O estudo novo termina antes deles. */
export const reservaRetaFinal = (diasAteAProva: number) => Math.min(21, Math.floor(diasAteAProva * 0.2))

/** Sem horários: ordena por data e numera as tarefas de cada dia na ordem em que foram planejadas (fixos, estudo, questões, simulado). */
function numerarDia(blocos: Bloco[]) {
  const ord = [...blocos].sort((a, b) => a.data.localeCompare(b.data)), n = new Map<string, number>()
  for (const b of ord) { const k = (n.get(b.data) ?? 0) + 1; n.set(b.data, k); b.ordem_dia = k }
  return ord
}

/**
 * Distribui estudo novo até (prova − reserva), questões todo dia disponível e, na reta final,
 * questões ampliadas + um simulado por semana. Revisões já agendadas descontam da capacidade do dia.
 */
export function gerarCronograma(e: Entrada) {
  const blocos: Bloco[] = [], avisos: string[] = []
  // Sem "janela" de horários o plano é por TEMPO DISPONÍVEL: cada dia tem uma quantidade de minutos e as tarefas só ganham uma ordem
  const semHorarios = !e.janela
  const minutosDiaDe = (d: string) => e.capacidadePorDia?.[d] ?? e.minutosDia
  const finalizar = (bl: Bloco[]) => (semHorarios ? numerarDia(bl) : colocar(bl, e))
  const ordem = [...(e.reforcos ?? []).map(t => ({ ...t, reforco: true })), ...ordemDeEstudo(e.disciplinas, e.topicos)]
  const falta = (from: number) => ordem.slice(from).reduce((s, t) => s + duracaoTopico(t), 0)
  for (const t of e.fixos) blocos.push({ tipo: 'estudo', topic_id: t.id, titulo: t.nome, data: t.plannedDate!, duracao_min: duracaoTopico(t), qtd_questoes: null })

  const fimEstudo = addDays(e.prova, -1)
  if (fimEstudo < e.hoje) return { blocos: finalizar(blocos), naoAlocados: ordem.length, minutosFaltantes: falta(0), avisos: ['A data da prova é hoje ou já passou.'] }

  const todos = dias(e.hoje, fimEstudo), reserva = reservaRetaFinal(todos.length), corte = todos.length - reserva
  // um dia com tempo informado vale pelo que foi informado (zero = sem estudo); sem informação, vale o dia da semana disponível
  const livres = (l: string[]) => l.filter(d => (e.capacidadePorDia?.[d] !== undefined ? e.capacidadePorDia[d] > 0 : e.diasDisponiveis.includes(dow(d))))
  const estudoDias = livres(todos.slice(0, corte)), finalDias = livres(todos.slice(corte))
  // questões do dia: até a meta, em múltiplos de 5, usando no máximo 35% do tempo do dia (2 min por questão); menos de 10 não vale um bloco
  const qtdDia = (d: string) => {
    if (e.questoesDia <= 0) return 0
    const q = Math.min(e.questoesDia, Math.floor(Math.round(minutosDiaDe(d) * 0.35) / 2 / 5) * 5)
    return q >= 10 ? q : 0
  }
  const qMinDe = (d: string) => qtdDia(d) * 2
  const janCache = new Map<string, [number, number][]>()
  const jan = (d: string) => janCache.get(d) ?? (janCache.set(d, janelasDe(e, d)), janCache.get(d)!)
  const livreTotal = (d: string) => (semHorarios ? minutosDiaDe(d) : jan(d).reduce((t, [x, y]) => t + (y - x), 0))
  const maior = (d: string) => (semHorarios ? minutosDiaDe(d) : Math.max(0, ...jan(d).map(([x, y]) => y - x)))
  const capDia = (d: string) => {
    const rev = Math.min(e.minutosRevisaoPorDia[d] ?? 0, Math.round(minutosDiaDe(d) * 0.3))
    const fixo = blocos.filter(b => b.data === d && b.tipo === 'estudo').reduce((s, b) => s + b.duracao_min, 0)
    return Math.max(0, Math.min(minutosDiaDe(d), livreTotal(d)) - rev - qMinDe(d) - fixo)
  }
  const discFoco = [...e.disciplinas].sort((a, b) => b.peso - a.peso)[0]?.nome ?? 'Revisão geral'
  const nome = new Map(e.disciplinas.map(d => [d.id, d.nome]))

  // Ritmo por grupo (ex.: "Semana 1"): cada grupo ocupa uma semana de calendário (segunda a domingo) e seus assuntos ficam
  // espaçados entre os dias úteis do bloco (3 assuntos em 5 dias úteis → dias 1, 2 e 4), em vez de amontoados no primeiro dia.
  const grupos: string[] = []
  ordem.forEach(t => { if (t.grupo && !grupos.includes(t.grupo)) grupos.push(t.grupo) })
  // A Semana 1 é a semana corrente; se restarem menos de 3 dias úteis nela, começa na próxima segunda (evita uma semana espremida)
  const segunda = weekStart(e.hoje)
  const restantes = estudoDias.filter(d => d <= addDays(segunda, 6) && capDia(d) >= MIN_BLOCO).length
  const semana0 = restantes >= 3 ? segunda : addDays(segunda, 7)
  const alvo = new Map<string, string>(), fimGrupo = new Map<string, string>()
  grupos.forEach((g, gi) => {
    const ini = addDays(semana0, 7 * gi), fim = addDays(ini, 6)
    const ts = ordem.filter(t => t.grupo === g), dd = estudoDias.filter(d => d >= ini && d <= fim && capDia(d) >= MIN_BLOCO)
    if (!dd.length) return
    fimGrupo.set(g, fim)
    ts.forEach((t, j) => alvo.set(t.id, dd[Math.floor((j * dd.length) / ts.length)]))
  })

  // Foco das questões do dia: UM assunto por bloco. Prioridade: revisão marcada para o dia, assunto fraco (em dias alternados, em rodízio)
  // e o que foi estudado na semana (o mais recente primeiro). Dentro da mesma semana não repete assunto até todos terem tido a vez.
  // O assunto escolhido vira o assunto da tarefa, para o atalho "Registrar questões" abrir já preenchido.
  const corta = (s: string) => (s.length > 40 ? s.slice(0, 39) + '…' : s)
  const idxDia = new Map(estudoDias.map((d, k) => [d, k]))
  const usadosNaSemana = new Map<string, Set<string>>()
  const focoQuestoes = (d: string): { texto: string; id: string | null } | null => {
    const sem = weekStart(d), k = idxDia.get(d) ?? -1
    const fraco = e.fracos?.length && k % 2 === 1 ? [e.fracos[Math.floor(k / 2) % e.fracos.length]] : []
    const estudados = blocos.filter(b => b.tipo === 'estudo' && b.topic_id && b.data >= sem && b.data <= d).sort((x, y) => y.data.localeCompare(x.data)).map(b => ({ nome: b.titulo, id: b.topic_id }))
    const vistos = new Set<string>(), itens: { nome: string; id: string | null }[] = []
    for (const x of [...(e.revisoesPorDia?.[d] ?? []).map(r => ({ nome: r.nome, id: r.id ?? null })), ...fraco.map(f => ({ nome: f.nome, id: f.id })), ...estudados])
      if (!vistos.has(x.nome)) { vistos.add(x.nome); itens.push(x) }
    if (!itens.length) return null
    const ja = usadosNaSemana.get(sem) ?? usadosNaSemana.set(sem, new Set()).get(sem)!
    if (!itens.some(x => !ja.has(x.nome))) ja.clear() // todos já tiveram a vez: recomeça o rodízio
    const escolhido = itens.find(x => !ja.has(x.nome))!
    ja.add(escolhido.nome)
    return { texto: corta(escolhido.nome), id: escolhido.id }
  }

  let i = 0
  for (const d of estudoDias) {
    const c0 = capDia(d); let livre = c0, primeira: Topico | null = null
    if (c0 >= 30) while (i < ordem.length) {
      const t = ordem[i], dur = Math.min(duracaoTopico(t), c0)
      if (dur > livre || (alvo.get(t.id) ?? '') > d) break // ainda não é o dia-alvo deste assunto
      blocos.push({ tipo: 'estudo', topic_id: t.reforco ? null : t.id, titulo: t.reforco ? `Reforço — ${t.nome}` : t.nome, data: d, duracao_min: dur, qtd_questoes: null })
      primeira ??= t; livre -= dur; i++
    }
    if (qtdDia(d) > 0 && livreTotal(d) >= MIN_BLOCO) {
      const fq = focoQuestoes(d), q = qtdDia(d)
      blocos.push({ tipo: 'questoes', topic_id: fq?.id ?? null, titulo: `${q} questões — ${fq?.texto ?? discFoco}`, data: d, duracao_min: q * 2, qtd_questoes: q })
    }
  }

  // reta final: por semana, o simulado vai para o dia com a maior janela contínua (se couber 90+ min); nos demais, questões
  const semanas = new Map<string, string[]>()
  finalDias.forEach(d => semanas.set(weekStart(d), [...(semanas.get(weekStart(d)) ?? []), d]))
  for (const grupo of semanas.values()) {
    const melhor = grupo.reduce((a, b) => (maior(b) > maior(a) ? b : a)), durSim = Math.min(minutosDiaDe(melhor), maior(melhor))
    for (const d of grupo) {
      if (d === melhor && durSim >= 90) blocos.push({ tipo: 'simulado', topic_id: null, titulo: 'Simulado', data: d, duracao_min: durSim, qtd_questoes: null })
      else if (e.questoesDia > 0 && livreTotal(d) >= MIN_BLOCO) {
        const dur = Math.min(Math.round(e.questoesDia * 1.5) * 2, Math.round(minutosDiaDe(d) * 0.6), maior(d)), q = Math.floor(dur / 2 / 5) * 5
        if (q >= 10) {
          const fq = focoQuestoes(d)
          blocos.push({ tipo: 'questoes', topic_id: fq?.id ?? null, titulo: `${q} questões — ${fq?.texto ?? 'Revisão geral'}`, data: d, duracao_min: q * 2, qtd_questoes: q })
        }
      }
    }
  }

  const grupoDe = new Map(ordem.map(t => [t.id, t.grupo])), passou = new Map<string, number>()
  for (const b of blocos) { const g = b.tipo === 'estudo' && b.topic_id ? grupoDe.get(b.topic_id) : null; if (g && fimGrupo.has(g) && b.data > fimGrupo.get(g)!) passou.set(g, (passou.get(g) ?? 0) + 1) }
  passou.forEach((n, g) => avisos.push(`${n} ${n === 1 ? 'assunto' : 'assuntos'} de "${g}" não ${n === 1 ? 'coube' : 'couberam'} na semana e ${n === 1 ? 'foi' : 'foram'} para a seguinte. Libere mais tempo ou reduza os assuntos da semana.`))
  const naoAlocados = ordem.length - i, minutosFaltantes = falta(i)
  if (naoAlocados) avisos.push(`Faltam cerca de ${Math.ceil(minutosFaltantes / 60)} h para cobrir ${naoAlocados} assuntos antes da prova. Informe mais tempo em "Minha semana", libere mais dias ou remova assuntos de baixa prioridade.`)
  if (!estudoDias.length && ordem.length) avisos.push('Nenhum dia disponível antes da prova: revise os dias da semana nas configurações.')
  return { blocos: finalizar(blocos), naoAlocados, minutosFaltantes, avisos }
}
