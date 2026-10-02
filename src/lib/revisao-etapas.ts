'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { TIPOS_ETAPA, type Etapa } from '@/lib/engine/etapas'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const refresh = () => ['/calendario', '/revisoes', '/inicio'].forEach(p => revalidatePath(p, 'layout'))
const COLS = 'id,tipo,titulo,qtd_questoes,concluida'

/** Acrescenta um item ao mini-checklist de uma revisão. */
export async function adicionarEtapaRevisao(reviewId: string, tipo: string, titulo: string, qtd: number | null): Promise<Etapa | null> {
  const { sb, uid } = await ctx()
  const t = titulo.trim().slice(0, 160)
  if (!(tipo in TIPOS_ETAPA) || !t) return null
  const q = tipo === 'questoes' && qtd && Number.isInteger(qtd) && qtd > 0 && qtd <= 1000 ? qtd : null
  const { count } = await sb.from('review_tasks').select('id', { count: 'exact', head: true }).eq('review_id', reviewId)
  const { data } = await sb.from('review_tasks').insert({ user_id: uid, review_id: reviewId, tipo, titulo: t, qtd_questoes: q, ordem: count ?? 0 }).select(COLS).single()
  refresh()
  return (data as Etapa) ?? null
}
export async function alternarEtapaRevisao(id: string, concluida: boolean) {
  const { sb } = await ctx()
  await sb.from('review_tasks').update({ concluida, concluida_em: concluida ? new Date().toISOString() : null }).eq('id', id)
  refresh()
}
export async function removerEtapaRevisao(id: string) {
  const { sb } = await ctx()
  await sb.from('review_tasks').delete().eq('id', id)
  refresh()
}
