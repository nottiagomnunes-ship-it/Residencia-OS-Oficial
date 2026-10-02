import type { SupabaseClient } from '@supabase/supabase-js'
import { montarBackup, TABELAS_BACKUP } from './engine/exportar'
import { lerTabelas } from './exportar-data'

/** Quantas linhas a conta tem hoje em cada tabela do backup (e quantos assuntos concluídos). Tabela ainda inexistente conta como zero. */
export async function contarAtuais(sb: SupabaseClient) {
  const contar = async (tabela: string) => (await sb.from(tabela).select('*', { count: 'exact', head: true })).count ?? 0
  const pares = await Promise.all(TABELAS_BACKUP.map(async t => [t, await contar(t)] as const))
  const { count: concluidos } = await sb.from('topics').select('id', { count: 'exact', head: true }).eq('status', 'concluido')
  return { contagem: Object.fromEntries(pares), concluidos: concluidos ?? 0 }
}

/** O estado atual da conta no formato do backup. É a cópia de segurança guardada antes de uma restauração (e o que "desfazer" devolve). */
export async function montarCopiaDeSeguranca(sb: SupabaseClient, user: { id: string; email?: string | null }) {
  const { data: perfil } = await sb.from('profiles').select('*').eq('id', user.id).maybeSingle()
  return montarBackup(perfil, await lerTabelas(sb, TABELAS_BACKUP), user.email ?? undefined, new Date().toISOString())
}

/** A cópia de segurança da última restauração, se houver. `disponivel` é falso se a migração 0026 ainda não foi aplicada. */
export async function carregarInfoRestauracao(sb: SupabaseClient): Promise<{ disponivel: boolean; criadoEm: string | null }> {
  const { data, error } = await sb.from('restauracoes').select('criado_em').maybeSingle()
  if (error) return { disponivel: false, criadoEm: null }
  return { disponivel: true, criadoEm: (data?.criado_em as string | undefined) ?? null }
}
