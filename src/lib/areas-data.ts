import type { SupabaseClient } from '@supabase/supabase-js'
import { AREAS, lerArea, normalizar, sugerirArea, type Area } from './engine/areas'

/**
 * A área de cada disciplina, por id. Em consulta SEPARADA de propósito: se a atualização do banco (campo "area") ainda não foi aplicada, o erro
 * fica aqui, `disponivel` vem falso e o resto do app segue como antes, sem nenhuma tela quebrar.
 */
export async function carregarAreas(sb: SupabaseClient): Promise<{ disponivel: boolean; mapa: Record<string, Area | null> }> {
  const { data, error } = await sb.from('disciplines').select('id,area')
  if (error) return { disponivel: false, mapa: {} }
  return { disponivel: true, mapa: Object.fromEntries((data ?? []).map(d => [d.id as string, lerArea(d.area)])) }
}

/** Põe a disciplina com a sua área (para as telas, que recebem a disciplina e a área juntas). */
export const comArea = <T extends { id: string }>(itens: T[], mapa: Record<string, Area | null>) => itens.map(i => ({ ...i, area: mapa[i.id] ?? null }))

/**
 * Depois de CRIAR disciplinas (adicionar à mão, importar o plano, primeiro cadastro): dá a área sugerida às que acabaram de nascer.
 * Só mexe nas disciplinas pelos nomes informados e que ainda estão sem área; as que já existiam não são tocadas sem a pessoa ver (isso é a tela "Organizar por áreas").
 * Qualquer falha é ignorada: a área é um complemento, nunca deve impedir a criação da disciplina.
 */
export async function atribuirAreasPorNome(sb: SupabaseClient, nomes: string[]): Promise<number> {
  const alvo = new Set(nomes.map(normalizar).filter(Boolean))
  if (!alvo.size) return 0
  const { data, error } = await sb.from('disciplines').select('id,nome,area')
  if (error) return 0
  const por = new Map<Area, string[]>()
  for (const d of data ?? []) {
    if (d.area || !alvo.has(normalizar(String(d.nome)))) continue
    const a = sugerirArea(String(d.nome)); if (a) por.set(a, [...(por.get(a) ?? []), d.id as string])
  }
  let n = 0
  for (const a of AREAS) { const ids = por.get(a); if (ids?.length) { const { error: e } = await sb.from('disciplines').update({ area: a }).in('id', ids); if (!e) n += ids.length } }
  return n
}
