import { xpEstudo, xpRevisao } from './review'

export type TipoCron = 'estudo' | 'revisao' | 'questoes' | 'simulado' | 'flashcards' | 'livre'
export type Cron = {
  id: string; item_id: string | null; tipo: TipoCron; titulo: string; topic_id: string | null; review_id: string | null
  planejado_min: number | null; qtd_questoes: number | null; iniciado_em: string; acumulado_seg: number; pausado: boolean
}

export const LIMITE_SESSAO_MIN = 240    // minutos sugeridos no máximo por sessão: acima disso quase sempre é "esqueci ligado"
export const LIMITE_MAX_MIN = 720       // o máximo aceito ao registrar (12 h)
export const AVISO_ESQUECIDO_MIN = 180  // a partir daqui a barra pergunta se esqueceu de pausar

/** Segundos contados: o que já foi acumulado nas pausas mais o trecho atual, se estiver rodando. */
export function segundosDecorridos(c: Pick<Cron, 'acumulado_seg' | 'iniciado_em' | 'pausado'>, agoraMs: number) {
  const trecho = c.pausado ? 0 : Math.max(0, Math.floor((agoraMs - Date.parse(c.iniciado_em)) / 1000))
  return c.acumulado_seg + trecho
}

/** 754 → "12:34"; 3725 → "1:02:05". */
export function formatarRelogio(seg: number) {
  const s = Math.max(0, Math.floor(seg)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), r = s % 60
  const d = (n: number) => String(n).padStart(2, '0')
  return h ? `${h}:${d(m)}:${d(r)}` : `${d(m)}:${d(r)}`
}

/** Minutos sugeridos ao finalizar: arredonda ao minuto mais próximo (no mínimo 1) e não passa de 4 h; `passouDoLimite` avisa quando foi cortado. */
export function minutosParaRegistrar(seg: number) {
  const bruto = Math.max(1, Math.round(seg / 60))
  return { minutos: Math.min(bruto, LIMITE_SESSAO_MIN), passouDoLimite: bruto > LIMITE_SESSAO_MIN }
}

export const pareceEsquecido = (seg: number) => seg / 60 >= AVISO_ESQUECIDO_MIN
/** Quanto da duração planejada já foi cumprido (0 a 100), ou null se a tarefa não tinha duração. */
export const progressoPlanejado = (seg: number, planejadoMin: number | null) => (planejadoMin && planejadoMin > 0 ? Math.min(100, Math.round((seg / 60 / planejadoMin) * 100)) : null)

export type OpcaoId = 'concluir' | 'registrar' | 'tempo'
export type Opcao = { id: OpcaoId; rotulo: string; detalhe: string }

/** XP que a opção rende, com o tempo medido: estudo = 30 + 1 a cada 10 min; revisão concluída sem resultado = 15; o resto, nada. */
export function xpPrevisto(id: OpcaoId, c: Pick<Cron, 'tipo'>, minutos: number) {
  if (id !== 'concluir') return 0
  return c.tipo === 'estudo' ? xpEstudo(minutos) : c.tipo === 'revisao' ? xpRevisao(null) : 0
}

/** O que dá para fazer com o tempo medido, conforme o tipo da tarefa. Questões e simulado concluem pelo registro (o resultado importa). */
export function opcoesDeFinalizar(c: Pick<Cron, 'tipo' | 'topic_id' | 'review_id'>, minutos: number): Opcao[] {
  const tempo: Opcao = { id: 'tempo', rotulo: c.tipo === 'livre' ? 'Registrar o tempo de estudo' : 'Só registrar o tempo', detalhe: c.tipo === 'livre' ? 'Entra nas horas estudadas.' : 'Entra nas horas estudadas e a tarefa continua aberta.' }
  const xp = (n: number) => (n > 0 ? ` +${n} XP` : '')
  switch (c.tipo) {
    case 'estudo': return [{ id: 'concluir', rotulo: c.topic_id ? 'Concluir o assunto' : 'Concluir a tarefa', detalhe: `Conta ${minutos} min${xp(xpPrevisto('concluir', c, minutos))}${c.topic_id ? ' e gera as revisões.' : '.'}` }, tempo]
    case 'revisao': return c.review_id
      ? [{ id: 'concluir', rotulo: 'Concluir a revisão', detalhe: `Conta ${minutos} min${xp(xpPrevisto('concluir', c, minutos))}.` }, { id: 'registrar', rotulo: 'Registrar o resultado', detalhe: 'Abre a revisão com o tempo preenchido (acerto e dificuldade).' }, tempo]
      : [tempo]
    case 'questoes': return [{ id: 'registrar', rotulo: 'Registrar as questões', detalhe: 'Abre o registro com o tempo preenchido.' }, tempo]
    case 'simulado': return [{ id: 'registrar', rotulo: 'Registrar o simulado', detalhe: 'Abre o registro com o tempo preenchido.' }, tempo]
    case 'flashcards': return [{ id: 'concluir', rotulo: 'Concluir a tarefa', detalhe: `Conta ${minutos} min.` }, tempo]
    default: return [tempo]
  }
}

/** Para onde ir quando a opção é "registrar": o formulário certo, já com o tempo (e o assunto, a quantidade ou a revisão, quando houver). */
export function destinoDoRegistro(c: Pick<Cron, 'tipo' | 'topic_id' | 'review_id' | 'qtd_questoes'>, minutos: number): string | null {
  const q = (...p: (string | number | false | null | undefined)[]) => p.filter(Boolean).join('&')
  if (c.tipo === 'questoes') return `/questoes?${q(c.topic_id && `alvo=t:${c.topic_id}`, c.qtd_questoes && `total=${c.qtd_questoes}`, `tempo=${minutos}`)}`
  if (c.tipo === 'simulado') return `/simulados?tempo=${minutos}`
  if (c.tipo === 'revisao' && c.review_id) return `/revisoes?${q(`rev=${c.review_id}`, `tempo=${minutos}`)}`
  return null
}
