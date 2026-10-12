import { addDays } from './review'
import { weekStart } from './calendar'

export type LinhaRanking = { apelido: string; eu: boolean; planejado: number; feito: number; questoes: number; dias: number }
export type Colocado = LinhaRanking & { pct: number | null; posicao: number | null }

/** Semana do ranking: de segunda a domingo; reinicia toda segunda. */
export const semanaDe = (hoje: string) => { const ini = weekStart(hoje); return { ini, fim: addDays(ini, 6) } }

/** % do plano da semana cumprido (até 100). Sem nada planejado até agora, fica sem porcentagem. */
export const pctDoPlano = (l: { planejado: number; feito: number }) => (l.planejado > 0 ? Math.min(100, Math.round((l.feito * 100) / l.planejado)) : null)

/**
 * Ordena pelo % do plano cumprido, depois questões e dias com estudo. Empates dividem a posição.
 * Quem ainda não tem nada planejado na semana fica no fim, sem posição.
 */
export function ordenarRanking(linhas: LinhaRanking[]): Colocado[] {
  const com = linhas.map(l => ({ ...l, pct: pctDoPlano(l) }))
  const chave = (c: { pct: number | null; questoes: number; dias: number }) => [c.pct ?? -1, c.questoes, c.dias]
  const ord = [...com].sort((a, b) => {
    const ka = chave(a), kb = chave(b)
    for (let i = 0; i < 3; i++) if (ka[i] !== kb[i]) return kb[i] - ka[i]
    return a.apelido.localeCompare(b.apelido, 'pt-BR')
  })
  let pos = 0
  return ord.map((c, k) => {
    if (c.pct === null) return { ...c, posicao: null }
    const igual = k > 0 && ord[k - 1].pct !== null && chave(ord[k - 1]).every((v, i) => v === chave(c)[i])
    if (!igual) pos = k + 1
    return { ...c, posicao: pos }
  })
}

const LIMPAR = (s: unknown, max: number) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
export const nomeDoGrupo = (s: unknown) => LIMPAR(s, 40)
export const apelidoValido = (s: unknown) => LIMPAR(s, 30)
/** Código de convite: 6 letras/números, sem os que se confundem (0, O, 1, I). */
export const codigoValido = (s: unknown) => { const c = String(s ?? '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return /^[A-HJ-NP-Z2-9]{6}$/.test(c) ? c : null }
/** O primeiro nome do perfil, como sugestão de apelido. */
export const apelidoSugerido = (nome: string | null | undefined) => apelidoValido((nome ?? '').split(' ')[0]) || 'Eu'

export const textoConvite = (nome: string, codigo: string, site = 'https://r1tmo.com.br') =>
  `Entra no meu grupo "${nome}" no R1TMO pra gente acompanhar a semana de estudos: ${site}/grupos?codigo=${codigo} (código ${codigo})`

export const ERROS_GRUPO: Record<string, string> = {
  codigo: 'Não achamos um grupo com esse código. Confira as 6 letras e números.',
  limite: 'Você já está em 10 grupos, o máximo. Saia de um para entrar em outro.',
  cheio: 'Esse grupo já tem 50 pessoas, o máximo.',
  nome: 'Dê um nome ao grupo.',
  apelido: 'Escolha como você vai aparecer no grupo.',
  falha: 'Não foi possível concluir. Tente de novo.',
  desligado: 'Os grupos ainda não foram ativados neste servidor.',
}
