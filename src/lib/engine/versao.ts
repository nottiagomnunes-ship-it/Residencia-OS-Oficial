/**
 * Erros de "versão trocada": o aparelho estava com a versão anterior do app aberta e, depois de uma publicação,
 * recebeu pedaços da versão nova (ou enviou um formulário que a versão nova não conhece). Recarregar a página resolve.
 */
const PADROES = [
  /ChunkLoadError/i, /Loading (CSS )?chunk [\w-]+ failed/i, /Failed to fetch dynamically imported module/i,
  /Importing a module script failed/i, /\[\w+\]\.call\b/, /reading 'call'\)/i, // runtime do webpack com módulo que não existe mais
  /Failed to find Server Action/i, /Server Action ".*" was not found/i,
]
export function ehErroDeVersao(mensagem: string | null | undefined, nome?: string | null) {
  const m = `${nome ?? ''} ${mensagem ?? ''}`
  return PADROES.some(p => p.test(m))
}

/** Recarrega sozinho no máximo uma vez por minuto (se a página nova também falhar, não fica num ciclo de recarregar). */
export const INTERVALO_RECARGA_MS = 60_000
export function podeRecarregar(agora: number, ultima: number | null) {
  return ultima == null || !Number.isFinite(ultima) || agora - ultima > INTERVALO_RECARGA_MS
}
