export type TipoAviso = 'ok' | 'erro' | 'info'

/** Quanto tempo cada aviso fica na tela. Erro fica mais (para dar tempo de ler e agir); com botão de ação (ex.: Desfazer), tempo suficiente para tocar. */
export const DURACAO_MS: Record<TipoAviso, number> = { ok: 6000, info: 6000, erro: 15000 }
export const DURACAO_COM_ACAO_MS = 8000
export const MAX_AVISOS = 3

/** `duracao` informado manda (null = não some sozinho); sem ele, vale o padrão do tipo, ou o de "com ação". */
export function duracaoDoAviso(tipo: TipoAviso, temAcao: boolean, duracao?: number | null): number | null {
  if (duracao !== undefined) return duracao
  return temAcao ? Math.max(DURACAO_COM_ACAO_MS, DURACAO_MS[tipo]) : DURACAO_MS[tipo]
}

/** Entra o aviso novo no fim da lista; se passar do máximo, saem os mais antigos (a tela nunca fica cheia de avisos). */
export const adicionarAviso = <T,>(lista: T[], novo: T, max = MAX_AVISOS): T[] => [...lista, novo].slice(-max)

const SEMANA = ['domingo', 'segunda', 'terça', 'quarta', 'quinta', 'sexta', 'sábado']
const dia = (d: string) => new Date(d + 'T12:00:00Z')
const somar = (d: string, n: number) => { const x = dia(d); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

/** "hoje", "amanhã", "ontem" ou "quinta, 08/10". */
export function rotuloDoDia(data: string, hoje: string): string {
  if (data === hoje) return 'hoje'
  if (data === somar(hoje, 1)) return 'amanhã'
  if (data === somar(hoje, -1)) return 'ontem'
  return `${SEMANA[dia(data).getUTCDay()]}, ${data.slice(8)}/${data.slice(5, 7)}`
}

/** Frase do aviso depois de adiar ou mover uma tarefa. O título é cortado para o aviso não ficar enorme. */
export function textoDaTarefaMovida(titulo: string, rotulo: string, max = 60) {
  const t = titulo.length > max ? titulo.slice(0, max - 1).trimEnd() + '…' : titulo
  return `Movida para ${rotulo}: ${t}`
}

/** O endereço sem alguns parâmetros (os que carregavam o aviso), mantendo os demais e o trecho "#". Atualizar a página não repete o aviso. */
export function urlSemParametros(href: string, chaves: string[]): string {
  const u = new URL(href, 'http://app.local')
  for (const k of chaves) u.searchParams.delete(k)
  return u.pathname + u.search + u.hash
}
