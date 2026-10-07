import { ehErroDeVersao, podeRecarregar } from '@/lib/engine/versao'

const CHAVE = 'r1tmo:recarregou-em'

/** No navegador: se o erro é de versão trocada (app publicado de novo), recarrega a página uma vez. Devolve true se recarregou. */
export function recarregarSeVersaoNova(error: Error) {
  if (!ehErroDeVersao(error.message, error.name)) return false
  let ultima: number | null = null
  try { ultima = Number(sessionStorage.getItem(CHAVE)) || null } catch { /* sem armazenamento: recarrega mesmo assim */ }
  if (!podeRecarregar(Date.now(), ultima)) return false
  try { sessionStorage.setItem(CHAVE, String(Date.now())) } catch { /* nada */ }
  location.reload()
  return true
}

/** Botão "Tentar de novo": recarrega a página inteira (pega a versão mais nova do app; o reset do React não pegaria). */
export function recarregarPagina() { location.reload() }
