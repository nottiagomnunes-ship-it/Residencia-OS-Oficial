import { norm } from './importar'

export const TIPOS_ETAPA = { video: 'Videoaula', leitura: 'Leitura', questoes: 'Questões', flashcards: 'Flashcards', outro: 'Outro' } as const
export type TipoEtapa = keyof typeof TIPOS_ETAPA
export type Etapa = { id: string; tipo: TipoEtapa; titulo: string; qtd_questoes: number | null; concluida: boolean }

export const tituloPadrao = (tipo: string, qtd?: number | null) =>
  tipo === 'video' ? 'Assistir à videoaula' : tipo === 'leitura' ? 'Ler o material' : tipo === 'flashcards' ? 'Revisar flashcards'
    : tipo === 'questoes' ? (qtd ? `Fazer ${qtd} questões` : 'Fazer questões') : ''

export const MODELO_PADRAO: { tipo: TipoEtapa; titulo: string; qtd_questoes: number | null }[] = [
  { tipo: 'video', titulo: 'Assistir à videoaula', qtd_questoes: null },
  { tipo: 'leitura', titulo: 'Ler o material', qtd_questoes: null },
  { tipo: 'questoes', titulo: 'Fazer 30 questões para fixar', qtd_questoes: 30 },
]
export function progressoEtapas(e: { concluida: boolean }[]) {
  const feitas = e.filter(x => x.concluida).length
  return { feitas, total: e.length, pct: e.length ? Math.round((feitas / e.length) * 100) : 0, completo: e.length > 0 && feitas === e.length }
}

export type Modelo = { id: string; tipo: TipoEtapa; titulo: string; qtd_questoes: number | null; conjunto: boolean }

/** Padrões criados na primeira vez que o usuário abre um assunto; os três primeiros formam o "conjunto padrão". */
export const MODELOS_INICIAIS: { tipo: TipoEtapa; titulo: string; qtd_questoes: number | null; conjunto: boolean }[] = [
  ...MODELO_PADRAO.map(m => ({ ...m, conjunto: true })),
  { tipo: 'flashcards', titulo: 'Revisar flashcards', qtd_questoes: null, conjunto: false },
  { tipo: 'leitura', titulo: 'Fazer resumo ou mapa mental', qtd_questoes: null, conjunto: false },
  { tipo: 'questoes', titulo: 'Refazer as questões que errei', qtd_questoes: null, conjunto: false },
]

/** Valida uma etapa ou padrão. O número de questões só vale para o tipo "questões". */
export function validarEtapa(tipo: string, titulo: string, qtd: number | null):
  { erro: string } | { tipo: TipoEtapa; titulo: string; qtd: number | null } {
  const t = titulo.trim().slice(0, 160)
  if (!(tipo in TIPOS_ETAPA)) return { erro: 'Tipo de etapa inválido.' }
  if (!t) return { erro: 'Escreva o que precisa ser feito.' }
  if (tipo === 'questoes' && qtd != null && !(Number.isInteger(qtd) && qtd >= 1 && qtd <= 1000)) return { erro: 'O número de questões deve ficar entre 1 e 1000.' }
  return { tipo: tipo as TipoEtapa, titulo: t, qtd: tipo === 'questoes' ? qtd : null }
}

export type TopicoLote = { id: string; status: string; grupo: string | null; discipline_id: string }
/**
 * Assuntos atingidos por um escopo: "sem_etapas", "todos", "g:<grupo>" (ex.: "g:Semana 2") ou "d:<disciplina>".
 * Assuntos concluídos ficam sempre de fora. Com `pularComEtapas`, quem já tem etapas também fica de fora.
 */
export function selecionarAssuntos(ts: TopicoLote[], etapasPorTopico: Record<string, number>, escopo: string, pularComEtapas: boolean) {
  const dentro = (t: TopicoLote) => escopo === 'sem_etapas' || escopo === 'todos'
    || (escopo.startsWith('g:') && t.grupo === escopo.slice(2)) || (escopo.startsWith('d:') && t.discipline_id === escopo.slice(2))
  return ts.filter(t => {
    if (t.status === 'concluido' || !dentro(t)) return false
    const tem = (etapasPorTopico[t.id] ?? 0) > 0
    return escopo === 'sem_etapas' ? !tem : !(pularComEtapas && tem)
  }).map(t => t.id)
}
/** Do que se quer adicionar, tira o que o assunto já tem (mesmo tipo e mesmo texto, sem diferenciar acento ou maiúscula). */
export function itensParaAdicionar<T extends { tipo: string; titulo: string }>(itens: T[], existentes: { tipo: string; titulo: string }[]) {
  const ja = new Set(existentes.map(e => `${e.tipo}|${norm(e.titulo)}`))
  return itens.filter(i => !ja.has(`${i.tipo}|${norm(i.titulo)}`))
}

export type LinhaLote = { lote_id: string; created_at: string; concluida: boolean; topic_id: string }
/** O último lote aplicado (o da etapa criada mais recentemente): quando, quantas etapas, em quantos assuntos e quantas já foram concluídas. */
export function ultimoLote(rows: LinhaLote[]) {
  if (!rows.length) return null
  const id = rows.reduce((a, b) => (b.created_at > a.created_at ? b : a)).lote_id, g = rows.filter(r => r.lote_id === id)
  return {
    id, em: g.reduce((m, r) => (r.created_at < m ? r.created_at : m), g[0].created_at), etapas: g.length,
    assuntos: new Set(g.map(r => r.topic_id)).size, concluidas: g.filter(r => r.concluida).length,
  }
}

export const LIMITE_DESFAZER_H = 24
/** O lote só pode ser desfeito até 24 h depois de aplicado (`em` = quando a primeira etapa do lote foi criada). */
export const podeDesfazer = (em: string, agora: number = Date.now(), horas = LIMITE_DESFAZER_H) => {
  const t = Date.parse(em)
  return !Number.isNaN(t) && agora - t <= horas * 3_600_000
}
export const minutosRestantes = (em: string, agora: number = Date.now(), horas = LIMITE_DESFAZER_H) =>
  Math.max(0, Math.floor((Date.parse(em) + horas * 3_600_000 - agora) / 60_000))
