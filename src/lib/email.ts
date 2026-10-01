/** Endereço público do app (para os links do e-mail). */
export const siteUrl = (fallback?: string) =>
  process.env.SITE_URL ?? (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : fallback ?? 'http://localhost:3000')

/** Envia um e-mail pelo Resend (https://resend.com). Sem a chave RESEND_API_KEY, devolve um erro explicando o que falta. */
export async function enviarEmail(para: string, assunto: string, html: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  const chave = process.env.RESEND_API_KEY?.trim()
  if (!chave) return { ok: false, erro: 'O envio de e-mails ainda não foi configurado no servidor (falta a chave RESEND_API_KEY).' }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.EMAIL_FROM ?? 'Residência OS <onboarding@resend.dev>', to: [para], subject: assunto, html, text: texto }),
    })
    if (r.ok) return { ok: true }
    if (r.status === 403) return { ok: false, erro: 'O Resend recusou o envio. Sem um domínio verificado, ele só envia para o e-mail da sua própria conta no Resend: use o mesmo e-mail nos dois.' }
    if (r.status === 401) return { ok: false, erro: 'A chave do Resend (RESEND_API_KEY) é inválida.' }
    return { ok: false, erro: `Não foi possível enviar o e-mail (erro ${r.status}).` }
  } catch { return { ok: false, erro: 'Não foi possível falar com o serviço de e-mail. Tente de novo.' } }
}
