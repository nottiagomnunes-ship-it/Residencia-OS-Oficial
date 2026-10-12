'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { calcularPlano } from '@/lib/plano-data'

/** Gera ou atualiza o cronograma: recalcula tudo que é automático e mantém revisões, concluídos e itens manuais. */
export async function gerarCronogramaAction() {
  const r = await planejarCronograma()
  redirect('/cronograma?msg=' + encodeURIComponent(r.msg))
}

/** O trabalho do "Gerar ou atualizar cronograma", sem mudar de página (usado também pelo assistente inicial e pelo "Recalcular rota"). */
export async function planejarCronograma(): Promise<{ ok: boolean; msg: string }> {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const c = await calcularPlano(sb, user.id)
  if (!c.ok) return c
  const { hoje, r, fixos, plan, topicosDoPlano } = c

  // troca o plano automático antigo pelo novo numa única transação (revisões, concluídos e itens manuais não são tocados)
  const { error: falha } = await sb.rpc('aplicar_cronograma', {
    p_hoje: hoje,
    p_blocos: r.blocos.map(b => ({ tipo: b.tipo, topic_id: b.topic_id, titulo: b.titulo, data: b.data, hora_ini: b.hora_ini ?? null, hora_fim: b.hora_fim ?? null, duracao_min: b.duracao_min, qtd_questoes: b.qtd_questoes, ordem_dia: b.ordem_dia ?? null })),
    p_topicos: topicosDoPlano, // um por assunto: a data da 1ª parte
  })
  if (falha) return { ok: false, msg: 'Não foi possível atualizar o cronograma. O plano anterior foi mantido; tente de novo.' }

  ;['/cronograma', '/calendario', '/conteudos', '/disciplinas', '/inicio'].forEach(x => revalidatePath(x, 'layout'))
  const n = plan.length + fixos.length
  return { ok: true, msg: `Cronograma atualizado: ${n} assuntos planejados. ${r.avisos.join(' ')}`.trim() }
}
