/** Quais endereços abrem sem conta e para onde vai quem já entrou (usado no middleware). */

/** Entrada e cadastro: quem já está logado é levado para Hoje. */
export const ehEntrada = (caminho: string) => ['/login', '/cadastro'].some(p => caminho.startsWith(p))

/** Abre sem conta: a página inicial (só "/"), entrada, cadastro, recuperação de senha, links de e-mail, Termos, Privacidade e o agendador. */
export function ehPublica(caminho: string) {
  if (caminho === '/') return true
  return ehEntrada(caminho) || ['/recuperar-senha', '/auth', '/api/cron', '/termos', '/privacidade'].some(p => caminho.startsWith(p))
}

/** Para onde mandar: sem conta numa página fechada → entrada; com conta na página inicial ou na entrada → Hoje; senão, null (segue). */
export function destinoDoLogin(caminho: string, logado: boolean): string | null {
  if (!logado && !ehPublica(caminho)) return '/login'
  if (logado && (caminho === '/' || ehEntrada(caminho))) return '/inicio'
  return null
}
