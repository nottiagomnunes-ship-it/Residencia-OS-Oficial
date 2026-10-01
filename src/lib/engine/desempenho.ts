import { addDays } from './review'
import { weekStart } from './calendar'

export type SetQ = { discipline_id: string | null; topic_id: string | null; total: number; acertos: number; realizado_em: string }
export const LIMITE_FOCO = 65   // abaixo disso o assunto/disciplina pede atenção
export const MIN_QUESTOES = 10  // amostra mínima para julgar um assunto
export const pct = (acertos: number, total: number) => (total > 0 ? Math.round((acertos / total) * 100) : null)

export function agregarPor(sets: SetQ[], chave: 'discipline_id' | 'topic_id') {
  const m = new Map<string, { total: number; acertos: number }>()
  for (const s of sets) {
    const k = s[chave]; if (!k) continue
    const a = m.get(k) ?? { total: 0, acertos: 0 }; a.total += s.total; a.acertos += s.acertos; m.set(k, a)
  }
  return m
}

/** Prioridade de um assunto: 2+ sinais = alta, 1 = média. Sinais: acerto baixo, muitos erros, revisão atrasada, erros por falta de conteúdo. */
export function prioridadeAssunto(x: { nome: string; total: number; acertos: number; revisoesAtrasadas: number; errosConteudo: number }, cfg = { limite: LIMITE_FOCO, minimo: MIN_QUESTOES }) {
  const acerto = pct(x.acertos, x.total), erradas = x.total - x.acertos, razoes: string[] = []
  if (acerto != null && x.total >= cfg.minimo && acerto < cfg.limite) razoes.push(`${acerto}% de acerto`)
  if (erradas >= 8) razoes.push(`${erradas} questões erradas`)
  if (x.revisoesAtrasadas > 0) razoes.push(x.revisoesAtrasadas === 1 ? 'revisão atrasada' : `${x.revisoesAtrasadas} revisões atrasadas`)
  if (x.errosConteudo >= 3) razoes.push(`${x.errosConteudo} erros por falta de conteúdo`)
  const nivel: 'alta' | 'media' | 'baixa' = razoes.length >= 2 ? 'alta' : razoes.length === 1 ? 'media' : 'baixa'
  return { nivel, razoes, frase: razoes.length ? `${x.nome}: ${razoes.join(', ')}.` : null, pontos: razoes.length * 10 + (acerto == null ? 0 : (100 - acerto) / 10) }
}

/** Alerta por disciplina: acerto abaixo do limite nas últimas ~50 questões (sessões inteiras, das mais recentes). */
export function recomendacoes(sets: SetQ[], disciplinas: { id: string; nome: string }[], janela = 50, minimo = 30, limite = LIMITE_FOCO) {
  const out: { disciplina: string; acerto: number; n: number; texto: string }[] = []
  for (const d of disciplinas) {
    let n = 0, a = 0
    for (const s of sets.filter(s => s.discipline_id === d.id).sort((x, y) => y.realizado_em.localeCompare(x.realizado_em))) {
      if (n >= janela) break; n += s.total; a += s.acertos
    }
    const p = pct(a, n)
    if (p != null && n >= minimo && p < limite)
      out.push({ disciplina: d.nome, acerto: p, n, texto: `Você teve desempenho abaixo de ${limite}% em ${d.nome} nas últimas ${n} questões. Considere revisar os conteúdos antes de continuar para o próximo bloco.` })
  }
  return out.sort((x, y) => x.acerto - y.acerto)
}

/** Últimas N semanas (segunda a domingo): questões, % de acerto e horas estudadas. */
export function serieSemanal(sets: SetQ[], stats: { data: string; minutos: number }[], hoje: string, semanas = 8) {
  const ini = weekStart(hoje)
  return Array.from({ length: semanas }, (_, i) => {
    const s = addDays(ini, -7 * (semanas - 1 - i)), f = addDays(s, 6)
    const q = sets.filter(x => x.realizado_em >= s && x.realizado_em <= f)
    const total = q.reduce((n, x) => n + x.total, 0), ac = q.reduce((n, x) => n + x.acertos, 0)
    const min = stats.filter(x => x.data >= s && x.data <= f).reduce((n, x) => n + x.minutos, 0)
    return { semana: `${s.slice(8)}/${s.slice(5, 7)}`, questoes: total, acerto: pct(ac, total), horas: Math.round(min / 6) / 10 }
  })
}
