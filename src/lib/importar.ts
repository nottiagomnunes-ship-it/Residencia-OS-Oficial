'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { parseCronograma, norm, type ItemImportado } from '@/lib/engine/importar'

const CORES = ['#22C55E', '#3B82F6', '#F59E0B', '#EC4899', '#A855F7', '#EF4444', '#14B8A6', '#F97316']
async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
type SB = Awaited<ReturnType<typeof ctx>>['sb']
const chunks = <T,>(a: T[], n = 100) => Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n))
const refresh = () => ['/importar', '/conteudos', '/disciplinas', '/cronograma', '/calendario', '/desempenho'].forEach(p => revalidatePath(p, 'layout'))

/** Remove só assuntos "limpos": não iniciados/planejados e sem questões, revisões, sessões ou erros ligados. */
async function removerSemHistorico(sb: SB) {
  const { data: ts } = await sb.from('topics').select('id,status')
  const comHist = new Set<string>()
  for (const tab of ['question_sets', 'reviews', 'study_sessions', 'error_notebook', 'topic_tasks']) {
    const { data } = await sb.from(tab).select('topic_id').not('topic_id', 'is', null).limit(20000)
    data?.forEach(r => comHist.add(r.topic_id))
  }
  const ids = (ts ?? []).filter(t => (t.status === 'nao_iniciado' || t.status === 'planejado') && !comHist.has(t.id)).map(t => t.id)
  for (const c of chunks(ids)) await sb.from('topics').delete().in('id', c)
  return { removidos: ids.length, mantidos: (ts?.length ?? 0) - ids.length }
}
async function removerDisciplinasVazias(sb: SB) {
  const [{ data: ds }, { data: ts }, { data: qs }, { data: er }] = await Promise.all([
    sb.from('disciplines').select('id'), sb.from('topics').select('discipline_id'),
    sb.from('question_sets').select('discipline_id').limit(20000), sb.from('error_notebook').select('discipline_id').limit(20000),
  ])
  const usadas = new Set([...(ts ?? []), ...(qs ?? []), ...(er ?? [])].map(x => x.discipline_id))
  const ids = (ds ?? []).filter(d => !usadas.has(d.id)).map(d => d.id)
  for (const c of chunks(ids)) await sb.from('disciplines').delete().in('id', c)
  return ids.length
}

export async function lerPdf(fd: FormData): Promise<{ texto?: string; erro?: string }> {
  await ctx()
  const f = fd.get('pdf')
  if (!(f instanceof File) || f.size === 0) return { erro: 'Selecione um arquivo PDF.' }
  if (f.size > 4 * 1024 * 1024) return { erro: 'O PDF passa de 4 MB. Divida o arquivo ou cole o texto.' }
  if (f.type !== 'application/pdf' && !f.name.toLowerCase().endsWith('.pdf')) return { erro: 'O arquivo precisa ser um PDF.' }
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(await f.arrayBuffer()))
    const { text } = await extractText(pdf, { mergePages: true })
    const t = (Array.isArray(text) ? text.join('\n') : text).trim()
    if (t.length < 20) return { erro: 'Não consegui extrair texto: o PDF parece ser uma imagem escaneada. Cole o texto manualmente.' }
    return { texto: t.slice(0, 200000) }
  } catch { return { erro: 'Não consegui ler esse PDF. Tente copiar e colar o texto.' } }
}

export async function importarCronograma(texto: string, substituir: boolean): Promise<{ ok: boolean; erro?: string; resumo?: string }> {
  const { sb, uid } = await ctx()
  const { itens } = parseCronograma(texto, hojeBR())
  if (!itens.length) return { ok: false, erro: 'Não encontrei nenhum assunto. Confira o formato ou coloque títulos de disciplina com # antes dos assuntos.' }
  if (itens.length > 2000) return { ok: false, erro: 'Limite de 2.000 assuntos por importação.' }

  const rem = substituir ? await removerSemHistorico(sb) : { removidos: 0, mantidos: 0 }
  const { data: ds } = await sb.from('disciplines').select('id,nome,ordem')
  const mapa = new Map((ds ?? []).map(d => [norm(d.nome), d.id as string]))
  let ordem = Math.max(-1, ...(ds ?? []).map(d => d.ordem ?? 0)) + 1, novasDisc = 0
  for (const nome of new Set(itens.map(i => i.disciplina))) {
    if (mapa.has(norm(nome))) continue
    const { data } = await sb.from('disciplines').insert({ user_id: uid, nome, cor: CORES[ordem % CORES.length], peso: 3, ordem: ordem++ }).select('id').single()
    mapa.set(norm(nome), data!.id); novasDisc++
  }
  const { data: ex } = await sb.from('topics').select('id,discipline_id,nome,ordem')
  const chave = (d: string | undefined, n: string) => `${d}|${norm(n)}`
  const existentes = new Map((ex ?? []).map(t => [chave(t.discipline_id, t.nome), t]))
  const base = Math.max(-1, ...(ex ?? []).map(t => t.ordem ?? -1)) + 1 // a importação entra depois do que já existe, na ordem escrita
  const novos: (ItemImportado & { ordem: number })[] = [], reordenar: any[] = []
  itens.forEach((i, idx) => {
    const did = mapa.get(norm(i.disciplina)), ordem = base + idx, e = existentes.get(chave(did, i.nome))
    if (e) reordenar.push({ id: e.id, user_id: uid, discipline_id: did, nome: e.nome, grupo: i.grupo, ordem }) // já existe: só atualiza a ordem
    else novos.push({ ...i, ordem })
  })
  for (const c of chunks(novos, 500)) await sb.from('topics').insert(c.map(i => ({
    user_id: uid, discipline_id: mapa.get(norm(i.disciplina)), subcategoria: i.subcategoria, nome: i.nome, grupo: i.grupo, ordem: i.ordem,
    planned_date: i.data, planned_auto: false, status: i.data ? 'planejado' : 'nao_iniciado',
  })))
  for (const c of chunks(reordenar, 500)) await sb.from('topics').upsert(c)
  const discRem = substituir ? await removerDisciplinasVazias(sb) : 0
  refresh()
  const comData = novos.filter(i => i.data).length
  return { ok: true, resumo: [
    `${novos.length} assuntos novos importados${comData ? ` (${comData} com data fixa)` : ''}`,
    itens.length - novos.length ? `${itens.length - novos.length} já existiam e foram mantidos` : '',
    novasDisc ? `${novasDisc} disciplinas criadas` : '',
    substituir ? `${rem.removidos} assuntos antigos removidos${discRem ? `, ${discRem} disciplinas vazias removidas` : ''}` : '',
  ].filter(Boolean).join(' · ') + '.' }
}

export async function limparCatalogo(): Promise<{ resumo: string }> {
  const { sb } = await ctx()
  const r = await removerSemHistorico(sb), d = await removerDisciplinasVazias(sb)
  refresh()
  return { resumo: `${r.removidos} assuntos removidos${d ? ` e ${d} disciplinas vazias` : ''}. ${r.mantidos} assuntos foram mantidos por terem histórico ou estarem em andamento/concluídos.` }
}
