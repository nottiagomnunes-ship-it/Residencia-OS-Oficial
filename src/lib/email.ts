import { classificarErroResend, type CodigoEmail } from './engine/email'

/** Endereço público do app (para os links do e-mail). */
export const siteUrl = (fallback?: string) =>
  process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : fallback ?? 'http://localhost:3000')

/** Envia um e-mail pelo Resend (https://resend.com). `codigo` diz o tipo de falha (para o chamador decidir, por exemplo, desligar o lembrete). */
export async function enviarEmail(para: string, assunto: string, html: string, texto: string): Promise<{ ok: boolean; erro?: string; codigo?: CodigoEmail }> {
  const chave = process.env.RESEND_API_KEY?.trim()
  if (!chave) return { ok: false, codigo: 'nao_configurado', erro: 'O envio de e-mails ainda não foi configurado no servidor (falta a chave RESEND_API_KEY).' }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'Residência OS <onboarding@resend.dev>', to: [para], subject: assunto, html, text: texto }),
    })
    if (r.ok) return { ok: true }
    const corpo = await r.json().catch(() => null) as { message?: string } | null
    const codigo = classificarErroResend(r.status, corpo?.message ?? '')
    if (codigo === 'chave_invalida') return { ok: false, codigo, erro: 'A chave do Resend (RESEND_API_KEY) é inválida.' }
    if (codigo === 'recusado_destinatario') return { ok: false, codigo, erro: 'O Resend recusou o envio: sem domínio verificado, ele só entrega para o e-mail da conta dele.' }
    return { ok: false, codigo, erro: `Não foi possível enviar o e-mail (erro ${r.status}).` }
  } catch { return { ok: false, codigo: 'falha', erro: 'Não foi possível falar com o serviço de e-mail. Tente de novo.' } }
}
