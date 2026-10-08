import { supabaseAdmin } from '@/lib/supabase/admin'
import { todasAsLinhas } from '@/lib/paginar'
import { montarFunil, diasAtras, type Perfil } from '@/lib/engine/funil'

/**
 * Lê os dados do funil com a chave de serviço (todas as contas). Só chamar depois de conferir que quem pede é a administradora (`ehAdmin`).
 * Devolve null se a chave de serviço não estiver configurada ou a leitura falhar (a página mostra um aviso).
 */
export async function carregarFunil(hoje: string) {
  try { return await ler(hoje) } catch { return null } // o funil nunca derruba a página de Pendências
}

async function ler(hoje: string) {
  const sb = supabaseAdmin()
  const [perfis, admins, stats] = await Promise.all([
    todasAsLinhas<Perfil>((de, ate) => sb.from('profiles').select('id,onboarded,created_at').order('id').range(de, ate), 20000),
    sb.from('admins').select('uid'),
    todasAsLinhas<{ user_id: string; data: string }>((de, ate) => sb.from('daily_stats').select('user_id,data').order('user_id').order('data').range(de, ate), 100000),
  ])
  if (perfis.error || !perfis.data) return null
  const diasAtivos = new Map<string, Set<string>>()
  for (const s of stats.data ?? []) { let d = diasAtivos.get(s.user_id); if (!d) diasAtivos.set(s.user_id, d = new Set()); d.add(s.data) }
  // "tem plano": um pedido curto por conta (só existe/não existe), de 20 em 20, em vez de ler todos os assuntos de todo mundo
  const comPlano = new Set<string>()
  const ids = perfis.data.map(p => p.id)
  for (let i = 0; i < ids.length; i += 20) {
    const bloco = ids.slice(i, i + 20)
    const rs = await Promise.all(bloco.map(id => sb.from('topics').select('id').eq('user_id', id).limit(1)))
    rs.forEach((r, k) => { if (r.data?.length) comPlano.add(bloco[k]) })
  }
  const base = { perfis: perfis.data, admins: new Set((admins.data ?? []).map(a => a.uid as string)), comPlano, diasAtivos }
  return { geral: montarFunil(base), semana: montarFunil({ ...base, desde: diasAtras(hoje, 7) }) }
}
