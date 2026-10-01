'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { carregarLembrete } from '@/lib/lembretes-data'
import { montarLembrete } from '@/lib/engine/lembretes'
import { enviarEmail, siteUrl } from '@/lib/email'
import { AVISO_DESTINATARIO, TESTE_RECUSADO } from '@/lib/engine/email'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, user }
}

export async function salvarLembrete(fd: FormData) {
  const { sb, user } = await ctx()
  await sb.from('profiles').update({ lembrete_email: fd.get('ativo') === 'on', lembrete_aviso: null }).eq('id', user.id)
  revalidatePath('/configuracoes')
  redirect('/configuracoes?aviso=' + encodeURIComponent(fd.get('ativo') === 'on' ? 'Lembrete por e-mail ativado.' : 'Lembrete por e-mail desativado.'))
}

/** Envia agora, para o e-mail da conta, o resumo de hoje (mesmo que esteja vazio), para conferir se tudo está configurado. */
export async function enviarLembreteTeste() {
  const { sb, user } = await ctx()
  if (!user.email) redirect('/configuracoes?erro=' + encodeURIComponent('Sua conta não tem e-mail.'))
  const m = montarLembrete(await carregarLembrete(sb, user.id, hojeBR()), siteUrl())
  const r = await enviarEmail(user.email, `[Teste] ${m.assunto}`, m.html, m.texto)
  if (r.codigo === 'recusado_destinatario') {
    await sb.from('profiles').update({ lembrete_email: false, lembrete_aviso: AVISO_DESTINATARIO }).eq('id', user.id)
    revalidatePath('/configuracoes')
    redirect('/configuracoes?erro=' + encodeURIComponent(TESTE_RECUSADO))
  }
  redirect(r.ok ? '/configuracoes?aviso=' + encodeURIComponent(`E-mail de teste enviado para ${user.email}. Se não chegar em 1 ou 2 minutos, olhe o spam.`)
    : '/configuracoes?erro=' + encodeURIComponent(r.erro ?? 'Não foi possível enviar.'))
}
