import type { SupabaseClient } from '@supabase/supabase-js'
import { SEM_ASSUNTO, type Filtros } from './engine/banco'
import { ehLetra, type Alternativa, type Bloco } from './engine/provas'
import { BUCKET } from './provas-data'

/** O assunto de Conteúdos usado no filtro "topico": as questões ligadas a ele ou, sem ligação, com o mesmo nome na mesma disciplina. */
export async function assuntoDoFiltro(sb: SupabaseClient, f: Filtros) {
  if (!f.topico) return null
  const { data } = await sb.from('topics').select('id,nome,discipline_id').eq('id', f.topico).maybeSingle()
  return data as { id: string; nome: string; discipline_id: string } | null
}

/** Aplica os filtros a uma consulta em banco_questoes (a mesma regra na página, em "Montar lista" e em "Praticar"). */
export function aplicarFiltros<Q>(q: Q, f: Filtros, topico: { id: string; nome: string; discipline_id: string } | null): Q {
  let x = q as any
  if (f.area) x = x.eq('area', f.area)
  if (f.disciplina) x = x.eq('discipline_id', f.disciplina)
  if (f.assunto === SEM_ASSUNTO) x = x.is('assunto', null)
  else if (f.assunto) x = x.eq('assunto', f.assunto)
  if (topico) x = x.or(`topic_id.eq.${topico.id},and(discipline_id.eq.${topico.discipline_id},assunto.eq."${topico.nome.replace(/["\\]/g, '')}")`)
  if (f.banca) x = x.eq('banca', f.banca)
  if (f.situacao === 'nunca') x = x.eq('vezes', 0)
  if (f.situacao === 'errei') x = x.eq('ultimo_certo', false)
  if (f.situacao === 'acertei') x = x.eq('ultimo_certo', true)
  return x as Q
}

/** Uma questão para responder no Praticar: SEM o gabarito (ele só chega depois de responder). */
export type QuestaoPratica = { id: string; blocos: ({ tipo: 'texto'; texto: string } | { tipo: 'imagem'; caminho: string; url: string | null })[]; alternativas: Alternativa[]
  banca: string | null; ano: number | null; assunto: string | null; topic_id: string | null; discipline_id: string | null; vezes: number; acertos: number }

export async function carregarQuestaoPratica(sb: SupabaseClient, id: string): Promise<QuestaoPratica | null> {
  const { data: q } = await sb.from('banco_questoes').select('id,blocos,alternativas,banca,ano,assunto,topic_id,discipline_id,vezes,acertos').eq('id', id).maybeSingle()
  if (!q) return null
  const blocos = (Array.isArray(q.blocos) ? q.blocos : []) as Bloco[]
  const caminhos = blocos.flatMap(b => (b.tipo === 'imagem' ? [b.caminho] : []))
  const urls = new Map<string, string>()
  if (caminhos.length) { const { data } = await sb.storage.from(BUCKET).createSignedUrls(caminhos, 60 * 60 * 6); for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl) }
  return {
    id: q.id, banca: q.banca, ano: q.ano, assunto: q.assunto, topic_id: q.topic_id ?? null, discipline_id: q.discipline_id ?? null, vezes: q.vezes, acertos: q.acertos,
    alternativas: (Array.isArray(q.alternativas) ? q.alternativas : []).filter((a: Alternativa) => ehLetra(a?.letra)).map((a: Alternativa) => ({ letra: a.letra, texto: String(a.texto ?? '') })),
    blocos: blocos.map(b => (b.tipo === 'imagem' ? { ...b, url: urls.get(b.caminho) ?? null } : b)),
  }
}

/** Quantas questões do banco (com gabarito) existem para os filtros; 0 se o banco ainda não existe (sem a 0034). Para os atalhos "Praticar". */
export async function contarNoBanco(sb: SupabaseClient, f: Filtros, topico: { id: string; nome: string; discipline_id: string } | null = null) {
  const { count, error } = await aplicarFiltros(sb.from('banco_questoes').select('id', { count: 'exact', head: true }).eq('anulada', false).not('gabarito', 'is', null), f, topico)
  return error ? 0 : count ?? 0
}
