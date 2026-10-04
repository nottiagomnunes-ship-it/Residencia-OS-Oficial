/** Quem responde pelo app nos Termos e na Privacidade. Configurável no Vercel; sem configuração, um texto genérico (nada pessoal fixo no código). */
export function responsavel(env: Record<string, string | undefined> = process.env) {
  const nome = env.NEXT_PUBLIC_RESPONSAVEL?.trim() || 'a administração do Residência OS'
  const email = env.NEXT_PUBLIC_CONTATO?.trim()
  return { nome, email: email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null }
}
/** Data da versão atual dos textos (mude quando o conteúdo mudar). */
export const VERSAO_TERMOS = '04/10/2026'

export const TIPOS_MENSAGEM = { sugestao: 'Sugestão', problema: 'Problema', outro: 'Outro assunto', prova: 'Pedido de prova' } as const
/** Os tipos do formulário geral (o pedido de prova tem formulário próprio). */
export const TIPOS_DO_FORMULARIO = ['sugestao', 'problema', 'outro'] as const
export type TipoMensagem = keyof typeof TIPOS_MENSAGEM
