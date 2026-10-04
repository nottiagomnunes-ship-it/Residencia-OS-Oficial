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
const voltaDoBanco = (fd: FormData) => { const v = String(fd.get('volta') || ''); return /^\/banco(\/questoes)?(\?[^\s]*)?$/.test(v) ? v : '/banco/questoes' }
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

// ---------- Banco geral ----------

const comAviso = (volta: string, tipo: 'ok' | 'erro', msg: string) => `${volta}${volta.includes('?') ? '&' : '?'}${tipo}=${encodeURIComponent(msg)}`
const SEM_GERAL = 'Falta atualizar o banco: rode supabase/migrations/0037_banco_geral.sql no SQL Editor do Supabase.'

/** As questões escolhidas no formulário: as marcadas, ou (com "todas") todas as dos filtros da página, até 1000. */
async function idsDoFormulario(sb: Awaited<ReturnType<typeof supabaseServer>>, fd: FormData) {
  if (fd.get('todas') !== '1') return fd.getAll('sel').map(String).filter(x => /^[0-9a-f-]{36}$/i.test(x))
  const f = lerFiltros(Object.fromEntries(new URLSearchParams(String(fd.get('filtros') || ''))))
  const { data } = await aplicarFiltros(sb.from('banco_questoes').select('id'), f, await assuntoDoFiltro(sb, f)).limit(1000)
  return (data ?? []).map((q: { id: string }) => q.id)
}

/**
 * Administrador: publica questões do próprio banco no banco geral (todas as contas recebem). Vão só o enunciado, as alternativas,
 * o gabarito (a letra) e a classificação; o comentário fica só no banco do administrador. As figuras são copiadas para a pasta "geral/",
 * que todas as contas podem ler (assim apagar as do próprio banco não quebra as das outras contas).
 */
export async function publicarNoBancoGeral(fd: FormData) {
  const { sb } = await ctx()
  const volta = voltaDoBanco(fd)
  const ids = await idsDoFormulario(sb, fd)
  if (!ids.length) redirect(comAviso(volta, 'erro', 'Marque as questões que quer publicar.'))
  const { data: qs, error } = await sb.from('banco_questoes').select('id,blocos,gabarito,anulada').in('id', ids.slice(0, 1000))
  if (error) redirect(comAviso(volta, 'erro', 'Não foi possível ler as questões.'))
  const semGabarito = (qs ?? []).filter(q => !q.gabarito && !q.anulada).length
  const st = sb.storage.from('provas'), copiadas: Record<string, string> = {}
  const itens = []
  for (const q of qs ?? []) {
    const blocos: Bloco[] = []
    for (const b of (q.blocos ?? []) as Bloco[]) {
      if (b.tipo !== 'imagem' || b.caminho.startsWith('geral/')) { blocos.push(b); continue }
      if (!copiadas[b.caminho]) {
        const destino = `geral/${crypto.randomUUID()}.${b.caminho.split('.').pop() || 'png'}`
        const { error: e } = await st.copy(b.caminho, destino)
        if (e) {
          if (Object.keys(copiadas).length) await st.remove(Object.values(copiadas)).catch(() => {})
          redirect(comAviso(volta, 'erro', 'Não foi possível copiar as figuras para o banco geral. Nada foi publicado.'))
        }
        copiadas[b.caminho] = destino
      }
      blocos.push({ ...b, caminho: copiadas[b.caminho] })
    }
    itens.push({ id: q.id, blocos })
  }
  const { data: r, error: e2 } = await sb.rpc('publicar_no_banco_geral', { p_itens: itens, p_colecao: String(fd.get('colecao') || '').trim().slice(0, 120) || null })
  if (e2) {
    if (Object.keys(copiadas).length) await st.remove(Object.values(copiadas)).catch(() => {})
    redirect(comAviso(volta, 'erro', e2.code === 'PGRST202' ? SEM_GERAL : /administradora/.test(e2.message) ? 'Só a conta administradora publica no banco geral.' : 'Não foi possível publicar. Tente de novo.'))
  }
  refresh()
  const novas = Number(r?.novas) || 0, atual = Number(r?.atualizadas) || 0
  redirect(comAviso(volta, 'ok', [novas ? `${novas} ${novas === 1 ? 'questão publicada' : 'questões publicadas'} no banco geral` : null,
    atual ? `${atual} já ${atual === 1 ? 'estava' : 'estavam'} lá e ${atual === 1 ? 'foi atualizada' : 'foram atualizadas'}` : null].filter(Boolean).join('; ') +
    '. As outras contas recebem ao abrir Praticar ou Banco (sem os comentários).' + (semGabarito ? ` Atenção: ${semGabarito} sem gabarito.` : '')))
}

/** Administrador: tira questões do banco geral. As cópias que as contas já receberam continuam no banco delas. */
export async function retirarDoBancoGeral(fd: FormData) {
  const { sb } = await ctx()
  const volta = voltaDoBanco(fd)
  const ids = await idsDoFormulario(sb, fd)
  if (!ids.length) redirect(comAviso(volta, 'erro', 'Marque as questões que quer tirar do banco geral.'))
  const { data: n, error } = await sb.rpc('retirar_do_banco_geral', { p_ids: ids })
  if (error) redirect(comAviso(volta, 'erro', error.code === 'PGRST202' ? SEM_GERAL : 'Não foi possível tirar do banco geral.'))
  refresh()
  redirect(comAviso(volta, 'ok', `${n ?? 0} ${n === 1 ? 'questão saiu' : 'questões saíram'} do banco geral. Quem já tinha recebido continua com a cópia.`))
}

/** Traz de volta as questões do banco geral que a pessoa excluiu do próprio banco. */
export async function restaurarDoBancoGeral(fd: FormData) {
  const { sb, uid } = await ctx()
  const volta = voltaDoBanco(fd)
  await sb.from('banco_geral_removidas').delete().eq('user_id', uid)
  await sb.from('profiles').update({ banco_geral_em: null }).eq('id', uid)
  const { data } = await sb.rpc('sincronizar_banco_geral')
  refresh()
  const n = Number(data?.novas) || 0
  redirect(comAviso(volta, 'ok', n ? `${n} ${n === 1 ? 'questão do banco geral voltou' : 'questões do banco geral voltaram'} para o seu banco.` : 'Nenhuma questão para trazer de volta.'))
}

/**
 * "Ligar assuntos": todas as questões com um nome de assunto que ainda não está ligado a Matérias passam a usar o assunto escolhido
 * (alvo "t:<id>") ou um assunto novo com esse nome, criado em Matérias na disciplina escolhida (alvo "criar:<id da disciplina>").
 */
export async function ligarAssunto(fd: FormData) {
  const { sb } = await ctx()
  const volta = voltaDoBanco(fd), rotulo = String(fd.get('rotulo') || '').trim(), alvo = String(fd.get('alvo') || '')
  if (!rotulo || !alvo) redirect(comAviso(volta, 'erro', 'Escolha o assunto de Matérias para ligar.'))
  const { data } = await sb.from('banco_questoes').select('id').eq('assunto', rotulo).is('topic_id', null).limit(2000)
  const ids = (data ?? []).map((q: { id: string }) => q.id)
  if (!ids.length) redirect(comAviso(volta, 'erro', 'Não há mais questões com esse nome sem ligação.'))
  const r = await definirAssuntoDoBanco(ids, alvo.startsWith('t:') ? { topic_id: alvo.slice(2) } : alvo.startsWith('criar:') ? { assunto: rotulo, criar_em: alvo.slice(6) } : { assunto: rotulo })
  if (!r.ok) redirect(comAviso(volta, 'erro', r.erro ?? 'Não foi possível ligar.'))
  redirect(comAviso(volta, 'ok', `${r.n} ${r.n === 1 ? 'questão de' : 'questões de'} "${rotulo}" ${r.n === 1 ? 'ligada' : 'ligadas'} ao assunto de Matérias. Agora ${r.n === 1 ? 'conta' : 'contam'} no Desempenho dele.`))
}
