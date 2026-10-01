'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { METRICAS, PERIODOS } from '@/lib/engine/metas'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const refresh = () => ['/metas', '/inicio'].forEach(p => revalidatePath(p, 'layout'))

export async function criarMeta(fd: FormData) {
  const { sb, uid } = await ctx()
  const periodo = String(fd.get('periodo')), metrica = String(fd.get('metrica')), alvo = Number(fd.get('alvo'))
  if (!(periodo in PERIODOS) || !(metrica in METRICAS) || !(alvo > 0)) return
  await sb.from('goals').insert({ user_id: uid, periodo, metrica, alvo })
  refresh()
}
export async function excluirMeta(fd: FormData) {
  const { sb } = await ctx()
  await sb.from('goals').delete().eq('id', String(fd.get('id')))
  refresh()
}
/** Cria metas diárias de questões e horas a partir do que foi informado no onboarding. */
export async function metasDoPlano() {
  const { sb, uid } = await ctx()
  const { data: p } = await sb.from('profiles').select('daily_minutes,daily_questions_goal').eq('id', uid).single()
  const { data: ja } = await sb.from('goals').select('periodo,metrica').eq('periodo', 'dia')
  const tem = (m: string) => (ja ?? []).some(g => g.metrica === m)
  const novas = [
    !tem('questoes') && p?.daily_questions_goal ? { user_id: uid, periodo: 'dia', metrica: 'questoes', alvo: p.daily_questions_goal } : null,
    !tem('horas') && p?.daily_minutes ? { user_id: uid, periodo: 'dia', metrica: 'horas', alvo: Math.max(1, Math.round(p.daily_minutes / 60)) } : null,
  ].filter(Boolean)
  if (novas.length) await sb.from('goals').insert(novas as any[])
  refresh()
}
