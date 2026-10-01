import { supabaseAdmin } from '@/lib/supabase/admin'
import { carregarLembrete } from '@/lib/lembretes-data'
import { montarLembrete } from '@/lib/engine/lembretes'
import { enviarEmail, siteUrl } from '@/lib/email'
import { hojeBR } from '@/lib/dates'
import { AVISO_DESTINATARIO } from '@/lib/engine/email'

export const maxDuration = 60

/** Chamado todo dia pelo agendador da Vercel (vercel.json). Só aceita a chamada com o segredo CRON_SECRET. */
export async function GET(req: Request) {
  const segredo = process.env.CRON_SECRET
  if (!segredo || req.headers.get('authorization') !== `Bearer ${segredo}`) return new Response('Não autorizado', { status: 401 })
  const sb = supabaseAdmin(), hoje = hojeBR(), url = siteUrl(new URL(req.url).origin)
  const { data: perfis } = await sb.from('profiles').select('id,lembrete_ultimo').eq('lembrete_email', true)
  const resumo = { enviados: 0, sem_pendencia: 0, ja_enviado: 0, desligados: 0, erros: 0 }
  for (const p of perfis ?? []) {
    if (p.lembrete_ultimo === hoje) { resumo.ja_enviado++; continue }
    try {
      const { data: u } = await sb.auth.admin.getUserById(p.id)
      const email = u.user?.email
      if (!email) { resumo.erros++; continue }
      const m = montarLembrete(await carregarLembrete(sb, p.id, hoje), url)
      if (m.vazio) { resumo.sem_pendencia++; continue }
      const r = await enviarEmail(email, m.assunto, m.html, m.texto)
      if (r.ok) { await sb.from('profiles').update({ lembrete_ultimo: hoje }).eq('id', p.id); resumo.enviados++ }
      else if (r.codigo === 'recusado_destinatario') { await sb.from('profiles').update({ lembrete_email: false, lembrete_aviso: AVISO_DESTINATARIO }).eq('id', p.id); resumo.desligados++ }
      else resumo.erros++
    } catch { resumo.erros++ }
  }
  return Response.json(resumo)
}
