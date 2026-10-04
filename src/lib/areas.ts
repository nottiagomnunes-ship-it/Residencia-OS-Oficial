'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { ehArea, type Area } from '@/lib/engine/areas'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const PAGINAS = ['/disciplinas', '/desempenho', '/conteudos', '/questoes', '/caderno-de-erros', '/simulados']
const LIMITE = 500
const MSG_BANCO = 'Não foi possível salvar. Confira se a atualização do banco de dados (SQL 0027) foi aplicada.'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb }
}

/** Define (ou tira, com null) a área de UMA disciplina. */
export async function definirArea(id: string, area: string | null): Promise<{ ok: boolean; erro?: string }> {
  if (typeof id !== 'string' || !UUID.test(id) || (area !== null && !ehArea(area))) return { ok: false, erro: 'Escolha uma das áreas.' }
  const { sb } = await ctx()
  const { error } = await sb.from('disciplines').update({ area }).eq('id', id)
  if (error) return { ok: false, erro: MSG_BANCO }
  PAGINAS.forEach(p => revalidatePath(p, 'layout'))
  return { ok: true }
}

/**
 * Aplica várias de uma vez (a tela "Organizar por áreas"): agrupa por área e faz uma gravação por área.
 * Tudo é conferido antes: se qualquer item for inválido, nada é gravado.
 */
export async function aplicarAreas(pares: { id: string; area: string | null }[]): Promise<{ ok: boolean; aplicadas?: number; erro?: string }> {
  if (!Array.isArray(pares) || pares.length === 0 || pares.length > LIMITE) return { ok: false, erro: 'Nada para aplicar.' }
  const grupos = new Map<Area | null, Set<string>>()
  for (const p of pares) {
    if (!p || typeof p.id !== 'string' || !UUID.test(p.id) || (p.area !== null && !ehArea(p.area))) return { ok: false, erro: 'Há uma escolha inválida. Nada foi alterado.' }
    const a = p.area as Area | null, s = grupos.get(a) ?? new Set<string>(); s.add(p.id); grupos.set(a, s)
  }
  const { sb } = await ctx()
  let aplicadas = 0
  for (const [area, ids] of grupos) {
    const { error } = await sb.from('disciplines').update({ area }).in('id', [...ids])
    if (error) return { ok: false, aplicadas, erro: aplicadas ? 'Parte das áreas foi salva e parte não. Tente de novo.' : MSG_BANCO }
    aplicadas += ids.size
  }
  PAGINAS.forEach(p => revalidatePath(p, 'layout'))
  return { ok: true, aplicadas }
}

