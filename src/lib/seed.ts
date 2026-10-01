import type { SupabaseClient } from '@supabase/supabase-js'
import { CATALOGO } from './catalog'

export async function seedCatalog(sb: SupabaseClient, userId: string) {
  const { data: ds } = await sb.from('disciplines').select('id,nome').eq('user_id', userId)
  const rows = (ds ?? []).flatMap(d => Object.entries(CATALOGO[d.nome] ?? {}).flatMap(([sub, nomes]) =>
    nomes.map(nome => ({ user_id: userId, discipline_id: d.id, subcategoria: sub, nome }))))
  if (rows.length) await sb.from('topics').upsert(rows, { onConflict: 'discipline_id,nome', ignoreDuplicates: true })
}
