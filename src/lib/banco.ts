'use server'
import { createHash } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { validarLote, textoParaHash, lerFiltros, sortear, nomeDaLista } from '@/lib/engine/banco'
import { sugerirArea } from '@/lib/engine/areas'
import { aplicarFiltros, assuntoDoFiltro } from '@/lib/banco-data'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const SEM_TABELA = 'Falta atualizar o banco: rode supabase/migrations/0034_banco_questoes.sql no SQL Editor do Supabase.'
const semTabela = (e: { code?: string; message?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || /does not exist|schema cache/i.test(e.message ?? ''))
const refresh = () => ['/banco', '/questoes', '/desempenho', '/caderno-de-erros', '/inicio'].forEach(p => revalidatePath(p, 'layout'))

/** O texto do PDF, página por página (o navegador monta as questões e mostra a prévia). */
export async function lerPdfDeQuestoes(fd: FormData): Promise<{ paginas?: string[]; erro?: string }> {
  await ctx()
  const f = fd.get('pdf')
  if (!(f instanceof File) || f.size === 0) return { erro: 'Selecione um arquivo PDF.' }
  if (f.size > 4 * 1024 * 1024) return { erro: 'O PDF passa de 4 MB. Divida o arquivo em partes menores.' }
  try {
    const { extractText, getDocumentProxy } = await import('unpdf')
    const pdf = await getDocumentProxy(new Uint8Array(await f.arrayBuffer()))
    const { text } = await extractText(pdf, { mergePages: false })
    const paginas = (Array.isArray(text) ? text : [text]).map(t => String(t))
    if (paginas.join('').trim().length < 50) return { erro: 'Não consegui extrair texto: o PDF parece ser uma imagem escaneada.' }
    return { paginas }
  } catch { return { erro: 'Não consegui ler esse PDF.' } }
}

/** Cria a disciplina do lote quando ela ainda não existe (com a área sugerida pelo nome). Devolve o id. */
export async function criarDisciplinaDoBanco(nome: string): Promise<{ id?: string; erro?: string }> {
  const { sb, uid } = await ctx()
  const n = nome.trim().slice(0, 80)
  if (!n) return { erro: 'Dê um nome à disciplina.' }
  const { data: ex } = await sb.from('disciplines').select('id,nome')
  const igual = (ex ?? []).find(d => d.nome.trim().toLowerCase() === n.toLowerCase())
  if (igual) return { id: igual.id }
  const { data, error } = await sb.from('disciplines').insert({ user_id: uid, nome: n, cor: '#3B82F6', ordem: (ex ?? []).length, peso: 3 }).select('id').single()
  if (error || !data) return { erro: 'Não foi possível criar a disciplina.' }
  const area = sugerirArea(n)
  if (area) await sb.from('disciplines').update({ area }).eq('id', data.id) // sem a 0027, só não grava a área
  revalidatePath('/disciplinas')
  return { id: data.id }
}

/** Grava o lote: confere, calcula a impressão digital de cada questão e deixa o banco ignorar as repetidas. */
export async function importarNoBanco(dados: unknown): Promise<{ ok: true; novas: number; repetidas: number } | { ok: false; erro: string }> {
  const { sb, uid } = await ctx()
  const v = validarLote(dados, uid)
  if (!v.ok) return v
  const itens = v.questoes.map(q => ({ ...q, hash: createHash('sha256').update(textoParaHash(q.blocos, q.alternativas)).digest('hex') }))
  let novas = 0
  for (let i = 0; i < itens.length; i += 200) {
    const { data, error } = await sb.rpc('importar_banco', { p_itens: itens.slice(i, i + 200) })
    if (error) return { ok: false, erro: semTabela(error) ? SEM_TABELA : `Não foi possível gravar${novas ? ` (já entraram ${novas})` : ''}. Tente de novo: as repetidas não duplicam.` }
    novas += Number(data ?? 0)
  }
  refresh()
  return { ok: true, novas, repetidas: itens.length - novas }
}

/** Sorteia as questões que batem com os filtros e abre a lista na tela de prova. */
export async function montarLista(fd: FormData) {
  const { sb } = await ctx()
  const campo = (k: string) => (fd.get(k) == null ? undefined : String(fd.get(k)))
  const f = lerFiltros({ area: campo('area'), disciplina: campo('disciplina'), assunto: campo('assunto'), banca: campo('banca'), situacao: campo('situacao'), busca: campo('busca'), topico: campo('topico') })
  const qtd = Math.min(100, Math.max(1, Number(fd.get('quantidade')) || 10))
  const topico = await assuntoDoFiltro(sb, f)
  const q = aplicarFiltros(sb.from('banco_questoes').select('id,assunto,discipline_id').eq('anulada', false).not('gabarito', 'is', null).limit(5000), f, topico)
  const { data, error } = await q
  const volta = `/banco?erro=`
  if (error) redirect(volta + encodeURIComponent(semTabela(error) ? SEM_TABELA : 'Não foi possível buscar as questões.'))
  if (!data?.length) redirect(volta + encodeURIComponent('Nenhuma questão com gabarito bate com esses filtros.'))
  const escolhidas = sortear(data, qtd)
  let nomeDisc: string | null = null
  if (f.disciplina) { const { data: d } = await sb.from('disciplines').select('nome').eq('id', f.disciplina).maybeSingle(); nomeDisc = d?.nome ?? null }
  const { data: tent, error: e2 } = await sb.rpc('montar_lista', { p_nome: nomeDaLista([nomeDisc, f.assunto ?? topico?.nome, f.banca], escolhidas.length), p_ids: escolhidas.map(x => x.id) })
  if (e2 || !tent) redirect(volta + encodeURIComponent('Não foi possível montar a lista. Tente de novo.'))
  redirect(`/provas/tentativa/${tent}`)
}

export async function excluirDoBanco(fd: FormData) {
  const { sb } = await ctx()
  await sb.from('banco_questoes').delete().eq('id', String(fd.get('id')))
  refresh()
}
