'use server'
import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'

/** Dispensa o aviso: marca como vistas todas as conquistas novas do usuário (a RLS limita às dele). */
export async function dispensarConquistas() {
  const sb = await supabaseServer()
  await sb.from('achievements').update({ visto: true }).eq('visto', false)
  revalidatePath('/', 'layout')
}
