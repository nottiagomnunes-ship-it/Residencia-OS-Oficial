'use server'
import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { contarAssuntos } from '@/lib/gamificacao-data'
import { levelFor } from '@/lib/engine/review'
import { passoDoRank } from '@/lib/engine/rank'

/** Dispensa o aviso de promoção: guarda o maior rank e o nível já comemorados (nunca diminui). */
export async function dispensarPromocoes() {
  const sb = await supabaseServer()
  const { data: p } = await sb.from('profiles').select('id,xp,rank_visto,nivel_visto').single()
  if (!p) return
  const a = await contarAssuntos(sb)
  await sb.from('profiles').update({
    rank_visto: Math.max(p.rank_visto ?? 0, passoDoRank(a.concluidos, a.total)), nivel_visto: Math.max(p.nivel_visto ?? 1, levelFor(p.xp ?? 0)),
  }).eq('id', p.id)
  revalidatePath('/', 'layout')
}
