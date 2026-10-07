// Análise de uso (Vercel Analytics e Speed Insights): antes de cada registro sair do aparelho,
// o endereço passa por aqui. Fica só o caminho da página, sem nada que identifique a pessoa ou um item dela.

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const NUMERO = /^\d+$/
const CODIGO = /^(?=.*\d)[A-Za-z0-9_-]{20,}$/ // tokens e códigos longos (com algum número; nomes de página longos ficam)

/** Troca ids, números e códigos longos do caminho por "[id]". */
export function mascararCaminho(caminho: string): string {
  const partes = caminho.split('/').map(p => {
    let s = p
    try { s = decodeURIComponent(p) } catch { /* fica como veio */ }
    if (s.includes('@')) return '[id]' // nunca um e-mail no caminho
    return UUID.test(s) || NUMERO.test(s) || CODIGO.test(s) ? '[id]' : p
  })
  return partes.join('/') || '/'
}

/**
 * Endereço que vai para a análise de uso: mesmo site, sem "?…" (filtros, códigos de login, e-mail)
 * e sem "#…", com os ids mascarados. Devolve null (não envia) se o endereço não puder ser lido
 * ou for uma página de login/autenticação por link.
 */
export function limparUrl(url: string): string | null {
  let u: URL
  try { u = new URL(url) } catch { return null }
  if (u.pathname.startsWith('/auth')) return null
  return `${u.origin}${mascararCaminho(u.pathname)}`
}

/** Para o `beforeSend` dos dois componentes: mantém o registro, só com o endereço limpo. */
export function limparEvento<T extends { url: string }>(evento: T): T | null {
  const url = limparUrl(evento.url)
  return url ? { ...evento, url } : null
}
