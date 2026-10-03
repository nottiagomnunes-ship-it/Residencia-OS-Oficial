'use server'
import { revalidatePath } from 'next/cache'
import { atribuirAreasPorNome } from '@/lib/areas-data'
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

/** Ids dos assuntos "limpos" (não iniciados/planejados e sem questões, revisões, sessões, erros ou etapas). O banco confere de novo antes de apagar. */
async function idsSemHistorico(sb: SB) {
  const { data: ts } = await sb.from('topics').select('id,status')
  const comHist = new Set<string>()
  for (const tab of ['question_sets', 'reviews', 'study_sessions', 'error_notebook', 'topic_tasks']) {
    const { data } = await sb.from(tab).select('topic_id').not('topic_id', 'is', null).limit(20000)
    data?.forEach(r => comHist.add(r.topic_id))
  }
  const ids = (ts ?? []).filter(t => (t.status === 'nao_iniciado' || t.status === 'planejado') && !comHist.has(t.id)).map(t => t.id as string)
  return { ids, mantidos: (ts?.length ?? 0) - ids.length }
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

/**
 * Importa o plano. O app calcula o que fazer (quais assuntos apagar, quais disciplinas e assuntos criar, quais reordenar);
 * `importar_plano` aplica tudo numa única transação no banco: ou entra por inteiro, ou nada muda.
 */
export async function importarCronograma(texto: string, substituir: boolean): Promise<{ ok: boolean; erro?: string; resumo?: string }> {
  const { sb } = await ctx()
  const { itens } = parseCronograma(texto, hojeBR())
  if (!itens.length) return { ok: false, erro: 'Não encontrei nenhum assunto. Confira o formato ou coloque títulos de disciplina com # antes dos assuntos.' }
  if (itens.length > 2000) return { ok: false, erro: 'Limite de 2.000 assuntos por importação.' }

  const sem = substituir ? await idsSemHistorico(sb) : { ids: [] as string[], mantidos: 0 }
  const apagar = new Set(sem.ids)
  const { data: ds } = await sb.from('disciplines').select('id,nome,ordem')
  const mapa = new Map((ds ?? []).map(d => [norm(d.nome), d.id as string]))
  let ordemDisc = Math.max(-1, ...(ds ?? []).map(d => d.ordem ?? 0)) + 1
  const novasDisc = new Map<string, string>() // chave normalizada → nome
  for (const i of itens) { const k = norm(i.disciplina); if (!mapa.has(k) && !novasDisc.has(k)) novasDisc.set(k, i.disciplina) }
  const disciplinas = [...novasDisc.values()].map(nome => ({ nome, cor: CORES[ordemDisc % CORES.length], ordem: ordemDisc++ }))

  const { data: ex } = await sb.from('topics').select('id,discipline_id,nome,ordem')
  const restantes = (ex ?? []).filter(t => !apagar.has(t.id)) // o que sobra depois da limpeza
  const chave = (d: string | undefined, n: string) => `${d ?? ''}|${norm(n)}`
  const existentes = new Map(restantes.map(t => [chave(t.discipline_id, t.nome), t]))
  const base = Math.max(-1, ...restantes.map(t => t.ordem ?? -1)) + 1 // a importação entra depois do que já existe, na ordem escrita
  const novos: (ItemImportado & { ordem: number; discipline_id: string; disciplina_nome: string })[] = [], reordenar: { id: string; grupo: string | null; ordem: number }[] = []
  itens.forEach((i, idx) => {
    const k = norm(i.disciplina), did = mapa.get(k), ordem = base + idx, e = did ? existentes.get(chave(did, i.nome)) : undefined
    if (e) reordenar.push({ id: e.id, grupo: i.grupo, ordem }) // já existe: só atualiza a ordem
    else novos.push({ ...i, ordem, discipline_id: did ?? '', disciplina_nome: did ? '' : (novasDisc.get(k) ?? i.disciplina) })
  })

  const { data: res, error } = await sb.rpc('importar_plano', { p_apagar: sem.ids, p_disciplinas: disciplinas, p_novos: novos, p_reordenar: reordenar, p_limpar_disciplinas: substituir })
  if (error) return { ok: false, erro: 'Não foi possível importar o plano. Nada foi alterado; tente de novo.' }
  await atribuirAreasPorNome(sb, disciplinas.map(d => d.nome)) // só as disciplinas criadas agora recebem a área sugerida; as que já existiam ficam como estão
  refresh()
  const r = res as { apagados: number; disciplinas_removidas: number }, comData = novos.filter(i => i.data).length
  return { ok: true, resumo: [
    `${novos.length} assuntos novos importados${comData ? ` (${comData} com data fixa)` : ''}`,
    itens.length - novos.length ? `${itens.length - novos.length} já existiam e foram mantidos` : '',
    disciplinas.length ? `${disciplinas.length} disciplinas criadas` : '',
    substituir ? `${r.apagados} assuntos antigos removidos${r.disciplinas_removidas ? `, ${r.disciplinas_removidas} disciplinas vazias removidas` : ''}` : '',
  ].filter(Boolean).join(' · ') + '.' }
}

/** "Só limpar": remove os assuntos sem histórico e as disciplinas que ficarem vazias, na mesma transação. */
export async function limparCatalogo(): Promise<{ resumo: string }> {
  const { sb } = await ctx()
  const sem = await idsSemHistorico(sb)
  const { data: res, error } = await sb.rpc('importar_plano', { p_apagar: sem.ids, p_disciplinas: [], p_novos: [], p_reordenar: [], p_limpar_disciplinas: true })
  if (error) return { resumo: 'Não foi possível limpar. Nada foi alterado; tente de novo.' }
  refresh()
  const r = res as { apagados: number; disciplinas_removidas: number }
  return { resumo: `${r.apagados} assuntos removidos${r.disciplinas_removidas ? ` e ${r.disciplinas_removidas} disciplinas vazias` : ''}. ${sem.mantidos} assuntos foram mantidos por terem histórico ou estarem em andamento/concluídos.` }
}
