export type CodigoEmail = 'nao_configurado' | 'chave_invalida' | 'recusado_destinatario' | 'falha'

/** Interpreta a recusa do Resend. O "recusado_destinatario" é o modo de teste: só entrega ao e-mail da conta dele, sem domínio verificado. */
export function classificarErroResend(status: number, mensagem: string): CodigoEmail {
  if (status === 401) return 'chave_invalida'
  if (status === 403 && /own email|testing emails|verify a domain/i.test(mensagem)) return 'recusado_destinatario'
  return 'falha'
}

/** Guardado na conta quando o lembrete é desligado sozinho (aparece em Configurações). */
export const AVISO_DESTINATARIO = 'O lembrete por e-mail foi desligado nesta conta: o envio de e-mails do app está em modo de teste e só entrega para o e-mail do administrador. O resto do app funciona normalmente.'
/** Mensagem do botão de teste quando o envio é recusado por esse motivo. */
export const TESTE_RECUSADO = 'Não foi possível enviar: o envio de e-mails do app está em modo de teste e só entrega para o e-mail do administrador. O lembrete foi desligado nesta conta. Se você é o administrador, crie a conta do Resend com o mesmo e-mail desta conta.'
