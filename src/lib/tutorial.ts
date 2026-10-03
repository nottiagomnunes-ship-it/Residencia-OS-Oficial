'use server'
import { supabaseServer } from '@/lib/supabase/server'

/** Marca o tutorial como visto (ele não aparece sozinho de novo). Sem a 0031 do banco, só não marca. */
export async function marcarTutorialVisto(): Promise<void> {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return
  await sb.from('profiles').update({ tutorial_visto_em: new Date().toISOString() }).eq('id', user.id).is('tutorial_visto_em', null)
}
