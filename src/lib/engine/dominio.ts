/** Endereços antigos do app na Vercel: quem abrir por eles vai para o endereço principal (DOMINIO_PRINCIPAL, ex.: r1tmo.com.br). */
export const ENDERECOS_ANTIGOS = ['r1tmo.vercel.app', 'residencia-os.vercel.app'] as const

/**
 * Para onde redirecionar, ou null para seguir normal. Só age com DOMINIO_PRINCIPAL configurado (assim nada muda antes do
 * domínio novo funcionar), só nos endereços antigos (as prévias da Vercel continuam) e nunca em /api/ (o agendador do
 * lembrete e o registro de erros não seguem redirecionamento). Mantém o caminho e o "?…" (links de e-mail continuam valendo).
 */
export function destinoDoDominio(host: string | null, caminho: string, busca: string, principal: string | undefined): string | null {
  const alvo = (principal ?? '').trim().toLowerCase().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (!alvo || !host) return null
  const h = host.toLowerCase().split(':')[0]
  if (h === alvo || !(ENDERECOS_ANTIGOS as readonly string[]).includes(h)) return null
  if (caminho.startsWith('/api/')) return null
  return `https://${alvo}${caminho}${busca}`
}
