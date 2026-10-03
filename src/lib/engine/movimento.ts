/** O que é preciso guardar para desfazer o adiamento (ou a mudança de data) de uma tarefa. */
export type Desfazer = {
  id: string; titulo: string; de: string; para: string; rotulo: string; status: string
  review: { id: string; due: string } | null            // a revisão também muda de prazo ao mover a tarefa dela
  topic: { id: string; planned: string | null; auto: boolean } | null   // o assunto, ao mover um estudo: a data planejada e se o plano o move sozinho
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const DATA = /^\d{4}-\d{2}-\d{2}$/
export const STATUS_RESTAURAVEIS = ['agendado', 'proximo', 'atrasado', 'adiado'] // "concluido" nunca: uma tarefa concluída não volta pelo desfazer

const objeto = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const dataOk = (v: unknown): v is string => typeof v === 'string' && DATA.test(v) && !Number.isNaN(Date.parse(v))

/** O "desfazer" passa pelo navegador, então é conferido campo a campo antes de qualquer coisa ser gravada. Devolve o objeto limpo, ou null. */
export function validarDesfazer(x: unknown): Desfazer | null {
  if (!objeto(x)) return null
  const { id, titulo, de, para, rotulo, status, review, topic } = x
  if (typeof id !== 'string' || !UUID.test(id) || typeof titulo !== 'string' || titulo.length > 300 || !dataOk(de) || !dataOk(para)) return null
  if (typeof rotulo !== 'string' || rotulo.length > 40 || typeof status !== 'string' || !STATUS_RESTAURAVEIS.includes(status)) return null
  let r: Desfazer['review'] = null, t: Desfazer['topic'] = null
  if (review != null) { if (!objeto(review) || typeof review.id !== 'string' || !UUID.test(review.id) || !dataOk(review.due)) return null; r = { id: review.id, due: review.due } }
  if (topic != null) {
    if (!objeto(topic) || typeof topic.id !== 'string' || !UUID.test(topic.id) || typeof topic.auto !== 'boolean' || (topic.planned != null && !dataOk(topic.planned))) return null
    t = { id: topic.id, planned: (topic.planned as string | null) ?? null, auto: topic.auto }
  }
  if (r && t) return null  // uma tarefa é de revisão OU de estudo com assunto, nunca as duas
  return { id, titulo, de, para, rotulo, status, review: r, topic: t }
}
