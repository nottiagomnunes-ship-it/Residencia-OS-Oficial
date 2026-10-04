'use server'
import { createHash } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { validarLote, textoParaHash, lerFiltros, sortear, nomeDaLista, sugerirAssunto } from '@/lib/engine/banco'
import { textoDosBlocos, type Bloco } from '@/lib/engine/provas'
import { sugerirArea, normalizar } from '@/lib/engine/areas'
import { aplicarFiltros, assuntoDoFiltro } from '@/lib/banco-data'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
/** Para onde voltar depois de um formulário da lista do banco: só para a própria página (com os filtros), nunca para fora do app. */
const voltaDoBanco = (fd: FormData) => { const v = String(fd.get('volta') || ''); return /^\/banco(\?[^\s]*)?$/.test(v) ? v : '/banco' }
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

/**
 * Define o assunto de questões do banco. Com um assunto de Matérias (topic_id), a questão fica ligada a ele (e à disciplina dele), e o
 * Desempenho do assunto passa a contar essas questões. Com só um nome, vira um rótulo (serve para filtrar). Os dois vazios: tira o assunto.
 */
export async function definirAssuntoDoBanco(ids: string[], escolha: { topic_id?: string | null; assunto?: string | null; criar_em?: string | null }): Promise<{ ok: boolean; n?: number; erro?: string; topic?: { id: string; nome: string; discipline_id: string } }> {
  const { sb, uid } = await ctx()
  const alvo = ids.filter(x => /^[0-9a-f-]{36}$/i.test(x)).slice(0, 2000)
  if (!alvo.length) return { ok: false, erro: 'Nenhuma questão escolhida.' }
  let muda: Record<string, unknown>, criado: { id: string; nome: string; discipline_id: string } | undefined
  const nomeNovo = (escolha.assunto ?? '').trim().slice(0, 120)
  if (!escolha.topic_id && nomeNovo && escolha.criar_em) {
    // "Criar também em Matérias": usa o assunto com esse nome na disciplina, se já existir; senão cria
    const { data: ts } = await sb.from('topics').select('id,nome,discipline_id').eq('discipline_id', escolha.criar_em).limit(2000)
    const igual = (ts ?? []).find(t => normalizar(t.nome) === normalizar(nomeNovo))
    if (igual) escolha = { topic_id: igual.id }
    else {
      const { data: novo, error } = await sb.from('topics').insert({ user_id: uid, discipline_id: escolha.criar_em, nome: nomeNovo }).select('id,nome,discipline_id').single()
      if (error || !novo) return { ok: false, erro: 'Não foi possível criar o assunto em Matérias.' }
      criado = novo as typeof criado; escolha = { topic_id: novo.id }
    }
  }
  if (escolha.topic_id) {
    const { data: t } = await sb.from('topics').select('id,nome,discipline_id').eq('id', escolha.topic_id).maybeSingle()
    if (!t) return { ok: false, erro: 'Assunto não encontrado.' }
    muda = { topic_id: t.id, assunto: t.nome, discipline_id: t.discipline_id }
  } else {
    const nome = (escolha.assunto ?? '').trim().slice(0, 120)
    muda = { topic_id: null, assunto: nome || null }
  }
  let n = 0
  for (let i = 0; i < alvo.length; i += 300) {
    const { error, count } = await sb.from('banco_questoes').update(muda, { count: 'exact' }).in('id', alvo.slice(i, i + 300))
    if (error) return { ok: false, erro: 'Não foi possível salvar o assunto.' }
    n += count ?? 0
  }
  refresh()
  return { ok: true, n, topic: criado }
}

/** Formulário da lista do banco: o assunto escolhido vai para as questões marcadas. */
export async function definirAssuntoEmLote(fd: FormData) {
  const ids = fd.getAll('sel').map(String), valor = String(fd.get('alvo') || ''), texto = String(fd.get('texto') || '')
  const volta = voltaDoBanco(fd)
  const criar = String(fd.get('criar_em') || '') || null, sep = volta.includes('?') ? '&' : '?'
  // um nome escrito vale quando nada da lista foi escolhido (ou foi escolhido "Outro")
  const escolha = valor.startsWith('t:') ? { topic_id: valor.slice(2) } : valor === 'nenhum' ? { assunto: null } : texto.trim() ? { assunto: texto, criar_em: criar } : null
  if (!escolha) redirect(`${volta}${sep}erro=${encodeURIComponent('Escolha o assunto na lista ou escreva o nome.')}`)
  const r = await definirAssuntoDoBanco(ids, escolha)
  redirect(`${volta}${volta.includes('?') ? '&' : '?'}${r.ok ? `ok=${encodeURIComponent(`Assunto salvo em ${r.n} ${r.n === 1 ? 'questão' : 'questões'}.`)}` : `erro=${encodeURIComponent(r.erro ?? 'Escolha um assunto.')}`}`)
}

/**
 * Sugere e grava o assunto das questões SEM assunto, pelo texto delas e pelos nomes dos seus assuntos em Matérias (da mesma disciplina,
 * ou de todas, se a questão não tem disciplina). Só grava quando todas as palavras do nome do assunto aparecem na questão.
 */
export async function sugerirAssuntosDoBanco(fd: FormData) {
  const { sb } = await ctx()
  const volta = voltaDoBanco(fd)
  const [{ data: qs }, { data: ts }] = await Promise.all([
    sb.from('banco_questoes').select('id,blocos,alternativas,discipline_id').is('assunto', null).limit(5000),
    sb.from('topics').select('id,nome,discipline_id').limit(5000),
  ])
  const porTopico = new Map<string, string[]>()
  for (const q of qs ?? []) {
    const texto = textoDosBlocos((q.blocos ?? []) as Bloco[]) + ' ' + ((q.alternativas ?? []) as { texto: string }[]).map(a => a.texto).join(' ')
    const cands = (ts ?? []).filter(t => !q.discipline_id || t.discipline_id === q.discipline_id)
    const t = sugerirAssunto(texto, cands)
    if (t) porTopico.set(t.id, [...(porTopico.get(t.id) ?? []), q.id])
  }
  let n = 0
  for (const [topic, ids] of porTopico) { const r = await definirAssuntoDoBanco(ids, { topic_id: topic }); n += r.n ?? 0 }
  const msg = n ? `Assunto encontrado para ${n} ${n === 1 ? 'questão' : 'questões'}. As outras continuam sem assunto: escolha à mão.` : 'Não achei o assunto pelo texto em nenhuma questão. Confira se os assuntos existem em Matérias → Assuntos, ou escolha à mão.'
  redirect(`${volta}${volta.includes('?') ? '&' : '?'}${n ? 'ok' : 'erro'}=${encodeURIComponent(msg)}`)
}
