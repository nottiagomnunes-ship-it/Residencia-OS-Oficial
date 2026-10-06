import type { SupabaseClient } from '@supabase/supabase-js'
import { MODELOS_INICIAIS, ultimoLote, podeDesfazer, minutosRestantes, type LinhaLote, type Modelo } from './engine/etapas'
import { todasAsLinhas } from '@/lib/paginar'

/** Padrões do usuário. Na primeira vez cria os iniciais (uma única vez, para ele poder apagar ou trocar todos). */
export async function carregarModelos(sb: SupabaseClient): Promise<Modelo[]> {
  const { data: p } = await sb.from('profiles').select('id').single()
  if (p) {
    const { data: marcou } = await sb.from('profiles').update({ modelos_semeados: true }).eq('id', p.id).eq('modelos_semeados', false).select('id')
    if (marcou?.length) await sb.from('etapa_modelos').insert(MODELOS_INICIAIS.map((m, i) => ({ ...m, user_id: p.id, ordem: i })))
  }
  const { data } = await sb.from('etapa_modelos').select('id,tipo,titulo,qtd_questoes,conjunto').order('ordem').order('created_at')
  return (data ?? []) as Modelo[]
}

/** Resumo do último lote aplicado em Conteúdos (ou null). */
export async function carregarUltimoLote(sb: SupabaseClient) {
  const { data } = await todasAsLinhas((de, ate) => sb.from('topic_tasks').select('lote_id,created_at,concluida,topic_id').not('lote_id', 'is', null).order('created_at', { ascending: false }).order('id').range(de, ate), 5000)
  const u = ultimoLote((data ?? []) as LinhaLote[])
  return u ? { ...u, desfazivel: podeDesfazer(u.em), minutosRestantes: minutosRestantes(u.em) } : null
}
