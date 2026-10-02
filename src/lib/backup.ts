'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { PAGINAS_AFETADAS } from '@/lib/backup-paginas'

/** Volta ao estado guardado antes da última restauração (e apaga essa cópia). Tudo ou nada. */
export async function desfazerRestauracao(): Promise<{ ok: boolean; erro?: string }> {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { error } = await sb.rpc('desfazer_restauracao')
  if (error) return { ok: false, erro: error.message.includes('Não há restauração') ? 'Não há restauração para desfazer.' : 'Não foi possível desfazer. Nada foi alterado; tente de novo.' }
  PAGINAS_AFETADAS.forEach(p => revalidatePath(p, 'layout'))
  return { ok: true }
}
