import { diffDays } from './review'
import { reorganizarAtrasadas, type ItemPlano, type Movimento } from './reorganizar'

/** Fatia do dia que as revisões atrasadas podem ocupar ao voltar para o plano (o resto fica para o estudo). */
export const FATIA_REVISOES = 0.3
export const DIAS_REVISOES = 21

export type Atrasada = ItemPlano & { origem: string | null; review_id: string | null; topic_id: string | null }

/** Separa as atrasadas pelo que o "Recalcular rota" faz com cada uma. */
export function separarAtrasadas(atrasadas: Atrasada[]) {
  const revisoes = atrasadas.filter(i => i.tipo === 'revisao' && i.review_id)
  const estudos = atrasadas.filter(i => i.origem === 'auto' && i.tipo === 'estudo' && !i.review_id)
  const descartar = atrasadas.filter(i => i.origem === 'auto' && (i.tipo === 'questoes' || i.tipo === 'simulado') && !i.review_id)
  const ficam = atrasadas.filter(i => !revisoes.includes(i) && !estudos.includes(i) && !descartar.includes(i))
  return { revisoes, estudos, assuntos: new Set(estudos.map(e => e.topic_id ?? e.id)).size, descartar, ficam }
}

/**
 * Leva as revisões atrasadas para os próximos dias, a mais antiga primeiro, usando no máximo ~30% do tempo de cada dia
 * (somando as revisões que o dia já tinha), para não engolir o estudo. O que não cabe em 21 dias fica como está.
 */
export function moverRevisoes(p: { hoje: string; limite?: string | null; revisoes: ItemPlano[]; futuras: ItemPlano[]; capacidade: (d: string) => number }): { movimentos: Movimento[]; semLugar: ItemPlano[] } {
  let dias = DIAS_REVISOES
  if (p.limite) dias = Math.min(dias, diffDays(p.hoje, p.limite) + 1)
  if (dias < 1 || !p.revisoes.length) return { movimentos: [], semLugar: [...p.revisoes] }
  return reorganizarAtrasadas({
    hoje: p.hoje, dias, atrasadas: p.revisoes, abertos: p.futuras,
    capacidade: d => { const c = p.capacidade(d); return c > 0 ? Math.max(30, Math.round(c * FATIA_REVISOES)) : 0 },
  })
}

/** Frase do fim do plano: "termina em 20/08, 9 dias depois do que estava" (ou antes, ou na mesma data). */
export function fraseDoFim(antes: string | null, depois: string | null) {
  const br = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
  if (!depois) return 'Nenhum assunto ficou para estudar no plano.'
  if (!antes) return `Os assuntos vão até ${br(depois)}.`
  const n = diffDays(antes, depois)
  if (n === 0) return `Os assuntos continuam terminando em ${br(depois)}.`
  return `Os assuntos passam a terminar em ${br(depois)}, ${Math.abs(n)} ${Math.abs(n) === 1 ? 'dia' : 'dias'} ${n > 0 ? 'depois' : 'antes'} do que estava (${br(antes)}).`
}

export const ultimaData = (ds: string[]) => (ds.length ? ds.reduce((a, b) => (b > a ? b : a)) : null)

export type Modo = 'equilibrada' | 'leve'
export const DIAS_DESFAZER = 7

/** Viabilidade: das horas de assunto que faltam, quantas cabem no tempo até a prova (a reta final fica para questões e simulados). */
export function viabilidade(minutosNecessarios: number, minutosFaltantes: number) {
  const nec = Math.max(0, minutosNecessarios), cabe = Math.max(0, nec - Math.max(0, minutosFaltantes))
  const pct = nec ? Math.floor((cabe / nec) * 100) : 100
  return { necessarioH: Math.ceil(nec / 60), cabeH: Math.floor(cabe / 60), faltaH: Math.ceil((nec - cabe) / 60), pct }
}

/** O recálculo ainda pode ser desfeito? (até 7 dias depois) */
export const podeDesfazer = (criadoEm: string | null | undefined, agora = new Date()) =>
  !!criadoEm && agora.getTime() - new Date(criadoEm).getTime() < DIAS_DESFAZER * 86400000

export const MSG_DESFAZER: Record<string, string> = {
  ok: 'Recálculo desfeito: o plano voltou a ser o de antes.',
  sem_versao: 'Não há recálculo para desfazer.',
  expirou: 'O recálculo tem mais de 7 dias e não pode mais ser desfeito.',
  concluiu: 'Você já concluiu tarefas do plano novo, então o recálculo não pode mais ser desfeito (o que você fez seria perdido).',
}
