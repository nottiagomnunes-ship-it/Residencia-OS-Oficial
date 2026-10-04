'use server'
import { createHash } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { validarLote, textoParaHash, lerFiltros, sortear, nomeDaLista, sugerirAssunto, rotuloDosAnos, SEM_ASSUNTO } from '@/lib/engine/banco'
import { textoDosBlocos, type Bloco } from '@/lib/engine/provas'
import { sugerirArea, normalizar, lerArea } from '@/lib/engine/areas'
import { aplicarFiltros, assuntoDoFiltro, podeOrganizar, SO_ADMIN, ehAdmin, carregarTemas } from '@/lib/banco-data'
import { lerListaDeTemas, sugerirTemas, type Tema } from '@/lib/engine/temas'

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
  const { sb } = await ctx()
  if (!(await podeOrganizar(sb))) return { erro: SO_ADMIN }
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
  if (!(await podeOrganizar(sb))) return { erro: SO_ADMIN }
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
export async function importarNoBanco(dados: unknown, publicar: { colecao: string | null } | null = null):
  Promise<{ ok: true; novas: number; repetidas: number; publicacao?: string; erroPublicacao?: string } | { ok: false; erro: string }> {
  const { sb, uid } = await ctx()
  if (!(await podeOrganizar(sb))) return { ok: false, erro: SO_ADMIN }
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
  if (!publicar) return { ok: true, novas, repetidas: itens.length - novas }
  // "Publicar também no banco geral": as deste arquivo (novas e as que já estavam no banco), achadas pela impressão digital
  const ids: string[] = []
  for (let i = 0; i < itens.length; i += 200) {
    const { data } = await sb.from('banco_questoes').select('id').in('hash', itens.slice(i, i + 200).map(q => q.hash))
    ids.push(...(data ?? []).map((q: { id: string }) => q.id))
  }
  const r = await publicarIds(sb, ids, publicar.colecao?.trim().slice(0, 120) || null)
  return r.ok ? { ok: true, novas, repetidas: itens.length - novas, publicacao: resumoDaPublicacao(r) }
    : { ok: true, novas, repetidas: itens.length - novas, erroPublicacao: `As questões entraram no seu banco, mas a publicação falhou: ${r.erro} Publique pelo Banco → Organizar.` }
}

/** Sorteia as questões que batem com os filtros e abre a lista na tela de prova. */
export async function montarLista(fd: FormData) {
  const { sb } = await ctx()
  const campo = (k: string) => (fd.get(k) == null ? undefined : String(fd.get(k)))
  const f = lerFiltros({ area: campo('area'), disciplina: campo('disciplina'), assunto: campo('assunto'), banca: campo('banca'), situacao: campo('situacao'), busca: campo('busca'), topico: campo('topico'), de: campo('de'), ate: campo('ate') })
  const qtd = Math.min(100, Math.max(1, Number(fd.get('quantidade')) || 10))
  const topico = await assuntoDoFiltro(sb, f)
  const q = aplicarFiltros(sb.from('banco_questoes').select('id,assunto,discipline_id').eq('anulada', false).not('gabarito', 'is', null).limit(5000), f, topico)
  const { data, error } = await q
  const volta = `/banco?erro=`
  if (error) redirect(volta + encodeURIComponent(semTabela(error) ? SEM_TABELA : 'Não foi possível buscar as questões.'))
  if (!data?.length) redirect(volta + encodeURIComponent('Nenhuma questão com gabarito bate com esses filtros.'))
  const escolhidas = sortear(data, qtd)
  let nomeDisc: string | null = null, nomeTema: string | null = null
  if (f.tema) { const { data: t } = await sb.from('temas').select('nome').eq('id', f.tema).maybeSingle(); nomeTema = t?.nome ?? null }
  if (f.disciplina) { const { data: d } = await sb.from('disciplines').select('nome').eq('id', f.disciplina).maybeSingle(); nomeDisc = d?.nome ?? null }
  const { data: tent, error: e2 } = await sb.rpc('montar_lista', { p_nome: nomeDaLista([nomeDisc, nomeTema ?? (f.assunto === SEM_ASSUNTO ? 'Sem assunto' : f.assunto ?? topico?.nome), f.banca, rotuloDosAnos(f)], escolhidas.length), p_ids: escolhidas.map(x => x.id) })
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
  if (!(await podeOrganizar(sb))) return { ok: false, erro: SO_ADMIN }
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
  const { sb } = await ctx()
  const ids = await idsDoFormulario(sb, fd), valor = String(fd.get('alvo') || ''), texto = String(fd.get('texto') || '')
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
  if (!(await podeOrganizar(sb))) redirect(comAviso(volta, 'erro', SO_ADMIN))
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

/** As questões escolhidas no formulário: as marcadas, ou (com "todas") todas as dos filtros da página, até 2000. */
async function idsDoFormulario(sb: Awaited<ReturnType<typeof supabaseServer>>, fd: FormData) {
  if (fd.get('todas') !== '1') return fd.getAll('sel').map(String).filter(x => /^[0-9a-f-]{36}$/i.test(x))
  const f = lerFiltros(Object.fromEntries(new URLSearchParams(String(fd.get('filtros') || ''))))
  const { data } = await aplicarFiltros(sb.from('banco_questoes').select('id'), f, await assuntoDoFiltro(sb, f)).limit(2000)
  return (data ?? []).map((q: { id: string }) => q.id)
}

/**
 * Publica no banco geral as questões `ids` do próprio banco (de 1000 em 1000). Copia as figuras para "geral/" antes; se algo falhar,
 * apaga as figuras copiadas naquele lote. Usado por "Publicar as marcadas" e pela importação com "Publicar também no banco geral".
 */
async function publicarIds(sb: Awaited<ReturnType<typeof supabaseServer>>, ids: string[], colecao: string | null):
  Promise<{ ok: true; novas: number; atualizadas: number; semGabarito: number } | { ok: false; erro: string; novas: number }> {
  const st = sb.storage.from('provas')
  let novas = 0, atualizadas = 0, semGabarito = 0
  for (let i = 0; i < ids.length; i += 1000) {
    const { data: qs, error } = await sb.from('banco_questoes').select('id,blocos,gabarito,anulada').in('id', ids.slice(i, i + 1000))
    if (error) return { ok: false, erro: 'Não foi possível ler as questões.', novas }
    semGabarito += (qs ?? []).filter(q => !q.gabarito && !q.anulada).length
    const copiadas: Record<string, string> = {}, itens = []
    const desfazer = async () => { if (Object.keys(copiadas).length) await st.remove(Object.values(copiadas)).catch(() => {}) }
    for (const q of qs ?? []) {
      const blocos: Bloco[] = []
      for (const b of (q.blocos ?? []) as Bloco[]) {
        if (b.tipo !== 'imagem' || b.caminho.startsWith('geral/')) { blocos.push(b); continue }
        if (!copiadas[b.caminho]) {
          const destino = `geral/${crypto.randomUUID()}.${b.caminho.split('.').pop() || 'png'}`
          const { error: e } = await st.copy(b.caminho, destino)
          if (e) { await desfazer(); return { ok: false, erro: `Não foi possível copiar as figuras para o banco geral.${novas ? ` Já tinham sido publicadas ${novas}.` : ' Nada foi publicado.'}`, novas } }
          copiadas[b.caminho] = destino
        }
        blocos.push({ ...b, caminho: copiadas[b.caminho] })
      }
      itens.push({ id: q.id, blocos })
    }
    const { data: r, error: e2 } = await sb.rpc('publicar_no_banco_geral', { p_itens: itens, p_colecao: colecao })
    if (e2) {
      await desfazer()
      return { ok: false, erro: e2.code === 'PGRST202' ? SEM_GERAL : /administradora/.test(e2.message) ? 'Só a conta administradora publica no banco geral.' : 'Não foi possível publicar. Tente de novo.', novas }
    }
    novas += Number(r?.novas) || 0; atualizadas += Number(r?.atualizadas) || 0
  }
  return { ok: true, novas, atualizadas, semGabarito }
}

/** Frase do resultado de uma publicação. */
const resumoDaPublicacao = (r: { novas: number; atualizadas: number; semGabarito: number }) =>
  [r.novas ? `${r.novas} ${r.novas === 1 ? 'questão publicada' : 'questões publicadas'} no banco geral` : null,
    r.atualizadas ? `${r.atualizadas} já ${r.atualizadas === 1 ? 'estava' : 'estavam'} lá e ${r.atualizadas === 1 ? 'foi atualizada' : 'foram atualizadas'}` : null].filter(Boolean).join('; ') +
  '. As outras contas recebem ao abrir Praticar ou Banco (sem os comentários).' + (r.semGabarito ? ` Atenção: ${r.semGabarito} sem gabarito.` : '')

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
  const r = await publicarIds(sb, ids, String(fd.get('colecao') || '').trim().slice(0, 120) || null)
  if (!r.ok) redirect(comAviso(volta, 'erro', r.erro))
  refresh()
  redirect(comAviso(volta, 'ok', resumoDaPublicacao(r)))
}

/**
 * Administrador: tira questões do banco geral e do banco das outras contas que as receberam (com a 0038; o histórico delas fica).
 * Quem já tinha a questão por conta própria continua com ela. Sem a 0038, só sai do banco geral (as cópias ficam).
 */
export async function retirarDoBancoGeral(fd: FormData) {
  const { sb } = await ctx()
  const volta = voltaDoBanco(fd)
  const ids = await idsDoFormulario(sb, fd)
  if (!ids.length) redirect(comAviso(volta, 'erro', 'Marque as questões que quer tirar do banco geral.'))
  const { data, error } = await sb.rpc('retirar_do_banco_geral', { p_ids: ids })
  if (error) redirect(comAviso(volta, 'erro', error.code === 'PGRST202' ? SEM_GERAL : 'Não foi possível tirar do banco geral.'))
  refresh()
  if (typeof data === 'number') // antes da 0038
    redirect(comAviso(volta, 'ok', `${data} ${data === 1 ? 'questão saiu' : 'questões saíram'} do banco geral, mas quem já tinha recebido continua com a cópia. Rode supabase/migrations/0038_retirar_das_contas.sql para tirar também das outras contas.`))
  const g = Number(data?.geral) || 0, c = Number(data?.copias) || 0
  redirect(comAviso(volta, 'ok', `${g} ${g === 1 ? 'questão saiu' : 'questões saíram'} do banco geral` +
    (c ? ` e ${c} ${c === 1 ? 'cópia foi tirada' : 'cópias foram tiradas'} das outras contas` : '') + '. O seu banco e o histórico de quem já respondeu não mudam.'))
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
  if (!(await podeOrganizar(sb))) redirect(comAviso(volta, 'erro', SO_ADMIN))
  if (!rotulo || !alvo) redirect(comAviso(volta, 'erro', 'Escolha o assunto de Matérias para ligar.'))
  const { data } = await sb.from('banco_questoes').select('id').eq('assunto', rotulo).is('topic_id', null).limit(2000)
  const ids = (data ?? []).map((q: { id: string }) => q.id)
  if (!ids.length) redirect(comAviso(volta, 'erro', 'Não há mais questões com esse nome sem ligação.'))
  const r = await definirAssuntoDoBanco(ids, alvo.startsWith('t:') ? { topic_id: alvo.slice(2) } : alvo.startsWith('criar:') ? { assunto: rotulo, criar_em: alvo.slice(6) } : { assunto: rotulo })
  if (!r.ok) redirect(comAviso(volta, 'erro', r.erro ?? 'Não foi possível ligar.'))
  redirect(comAviso(volta, 'ok', `${r.n} ${r.n === 1 ? 'questão de' : 'questões de'} "${rotulo}" ${r.n === 1 ? 'ligada' : 'ligadas'} ao assunto de Matérias. Agora ${r.n === 1 ? 'conta' : 'contam'} no Desempenho dele.`))
}

// ---------- Temas (lista geral: só etiqueta das questões, não mexe em Matérias nem no plano de ninguém) ----------

const SEM_TEMAS = 'Falta atualizar o banco: rode supabase/migrations/0040_temas.sql no SQL Editor do Supabase.'
const voltaDosTemas = (fd: FormData) => { const v = String(fd.get('volta') || ''); return /^\/banco\/(temas|questoes)(\?[^\s]*)?$/.test(v) ? v : '/banco/temas' }

/** Administradora: acrescenta temas à lista (texto colado; os repetidos não entram de novo). */
export async function adicionarTemas(fd: FormData) {
  const { sb } = await ctx()
  const volta = voltaDosTemas(fd)
  if (!(await ehAdmin(sb))) redirect(comAviso(volta, 'erro', 'Só a conta administradora mexe na lista de temas.'))
  const { temas, avisos } = lerListaDeTemas(String(fd.get('lista') || ''))
  if (!temas.length) redirect(comAviso(volta, 'erro', avisos[0] ?? 'Cole pelo menos um tema (ex.: "Anestesiologia > Via aérea difícil").'))
  const ja = await carregarTemas(sb)
  const chave = (t: { especialidade: string; nome: string }) => normalizar(t.especialidade) + '|' + normalizar(t.nome)
  const porChave = new Map(ja.map(t => [chave(t), t])), novos = temas.filter(t => !porChave.has(chave(t)))
  const semPalavras = (t: (typeof temas)[number]) => { const { palavras: _, ...r } = t; return r }
  if (novos.length) {
    let { error: e } = await sb.from('temas').insert(novos)
    if (e && /palavras/.test(e.message)) ({ error: e } = await sb.from('temas').insert(novos.map(semPalavras))) // sem a 0041
    if (e) redirect(comAviso(volta, 'erro', /relation|does not exist|schema cache/.test(e.message) ? SEM_TEMAS : 'Não foi possível salvar os temas.'))
  }
  // temas que já existiam e vieram com palavras-chave: junta as novas às que já tinham
  let comPalavras = 0
  for (const t of temas) {
    const velho = porChave.get(chave(t))
    if (!velho || !t.palavras) continue
    const antes = (velho.palavras ?? '').split(',').map(x => x.trim()).filter(Boolean), juntas = [...antes]
    for (const k of t.palavras.split(',').map(x => x.trim()).filter(Boolean)) if (!juntas.some(j => normalizar(j) === normalizar(k))) juntas.push(k)
    if (juntas.length > antes.length && !(await sb.from('temas').update({ palavras: juntas.join(', ').slice(0, 500) }).eq('id', velho.id)).error) comPalavras++
  }
  refresh()
  redirect(comAviso(volta, 'ok', `${novos.length} ${novos.length === 1 ? 'tema novo' : 'temas novos'}` + (temas.length > novos.length ? `; ${temas.length - novos.length} já ${temas.length - novos.length === 1 ? 'existia' : 'existiam'}` : '') +
    (comPalavras ? ` (${comPalavras} ${comPalavras === 1 ? 'ganhou' : 'ganharam'} palavras-chave novas)` : '') +
    (avisos.length ? `. ${avisos.length} ${avisos.length === 1 ? 'linha ficou' : 'linhas ficaram'} de fora: ${avisos[0]}` : '.')))
}

/** Administradora: muda o nome, a especialidade ou a área de um tema. As questões com ele passam a mostrar o nome novo quando forem publicadas de novo. */
export async function editarTema(fd: FormData) {
  const { sb } = await ctx()
  const volta = voltaDosTemas(fd), id = String(fd.get('id') || '')
  const nome = String(fd.get('nome') || '').trim().slice(0, 120), especialidade = String(fd.get('especialidade') || '').trim().slice(0, 80)
  if (!nome || !especialidade) redirect(comAviso(volta, 'erro', 'O tema precisa de nome e especialidade.'))
  const palavrasChave = fd.has('palavras') ? String(fd.get('palavras') || '').split(',').map(x => x.trim()).filter(Boolean).join(', ').slice(0, 500) || null : undefined
  const { error } = await sb.from('temas').update({ nome, especialidade, area: lerArea(fd.get('area')), ...(palavrasChave !== undefined ? { palavras: palavrasChave } : {}) }).eq('id', id)
  if (error) redirect(comAviso(volta, 'erro', /duplicate|unique/.test(error.message) ? 'Já existe um tema com esse nome nessa especialidade.' : 'Não foi possível salvar.'))
  await sb.from('banco_questoes').update({ assunto: nome }).eq('tema_id', id) // nas suas questões; nas outras contas, ao publicar de novo
  refresh()
  redirect(comAviso(volta, 'ok', 'Tema salvo. Publique de novo as questões dele para o nome novo chegar às outras contas.'))
}

/** Administradora: apaga um tema. As questões com ele perdem só a etiqueta. */
export async function excluirTema(fd: FormData) {
  const { sb } = await ctx()
  const volta = voltaDosTemas(fd)
  await sb.from('temas').delete().eq('id', String(fd.get('id') || ''))
  refresh()
  redirect(comAviso(volta, 'ok', 'Tema apagado. As questões que tinham esse tema ficaram sem tema.'))
}

/** Grava o tema nas questões: etiqueta, nome do assunto e (no seu banco) a disciplina e o assunto de Matérias com o mesmo nome, se você tiver. */
async function gravarTema(sb: Awaited<ReturnType<typeof supabaseServer>>, ids: string[], tema: Tema | null) {
  let muda: Record<string, unknown> = { tema_id: null }
  if (tema) {
    const [{ data: ds }, { data: ts }] = await Promise.all([sb.from('disciplines').select('id,nome').limit(500), sb.from('topics').select('id,nome,discipline_id').limit(5000)])
    const d = (ds ?? []).find(x => normalizar(x.nome) === normalizar(tema.especialidade)) ?? null
    const t = d ? (ts ?? []).find(x => x.discipline_id === d.id && normalizar(x.nome) === normalizar(tema.nome)) ?? null : null
    muda = { tema_id: tema.id, assunto: tema.nome, ...(tema.area ? { area: tema.area } : {}), ...(d ? { discipline_id: d.id } : {}), topic_id: t?.id ?? null }
  }
  let n = 0
  for (let i = 0; i < ids.length; i += 300) {
    const { error, count } = await sb.from('banco_questoes').update(muda, { count: 'exact' }).in('id', ids.slice(i, i + 300))
    if (error) return { ok: false as const, n }
    n += count ?? 0
  }
  return { ok: true as const, n }
}

/** Organizar (administradora): dá o tema escolhido às questões marcadas (ou a todas as dos filtros). "nenhum" tira o tema. */
export async function definirTemaEmLote(fd: FormData) {
  const { sb } = await ctx()
  const volta = voltaDoBanco(fd), alvo = String(fd.get('tema') || '')
  if (!(await ehAdmin(sb))) redirect(comAviso(volta, 'erro', 'Só a conta administradora dá tema às questões.'))
  if (!alvo) redirect(comAviso(volta, 'erro', 'Escolha o tema.'))
  const ids = await idsDoFormulario(sb, fd)
  if (!ids.length) redirect(comAviso(volta, 'erro', 'Marque as questões.'))
  const tema = alvo === 'nenhum' ? null : (await carregarTemas(sb)).find(t => t.id === alvo) ?? null
  if (alvo !== 'nenhum' && !tema) redirect(comAviso(volta, 'erro', 'Tema não encontrado.'))
  const r = await gravarTema(sb, ids, tema)
  if (!r.ok) redirect(comAviso(volta, 'erro', SEM_TEMAS))
  refresh()
  redirect(comAviso(volta, 'ok', `${tema ? `Tema "${tema.nome}"` : 'Tema tirado'} em ${r.n} ${r.n === 1 ? 'questão' : 'questões'}.` + (tema ? ' Publique de novo as que já estão no banco geral para o tema chegar às outras contas.' : '')))
}

/**
 * Organizar (administradora): procura no texto das questões SEM tema (as marcadas, ou todas as dos filtros) o nome de um tema da lista,
 * de preferência da mesma especialidade (pela disciplina ou pelo assunto atual, como "Anestesiologia"). Só grava quando todas as palavras do tema aparecem.
 */
export async function sugerirTemasPeloTexto(fd: FormData) {
  const { sb } = await ctx()
  const volta = voltaDoBanco(fd)
  if (!(await ehAdmin(sb))) redirect(comAviso(volta, 'erro', 'Só a conta administradora dá tema às questões.'))
  const temas = await carregarTemas(sb)
  if (!temas.length) redirect(comAviso(volta, 'erro', 'A lista de temas está vazia. Cadastre os temas primeiro (Organizar → Lista de temas).'))
  const marcadas = fd.get('todas') === '1' || fd.getAll('sel').length ? await idsDoFormulario(sb, fd) : null
  let q = sb.from('banco_questoes').select('id,blocos,alternativas,assunto,discipline_id,disciplines(nome)').is('tema_id', null)
  if (marcadas) q = q.in('id', marcadas.slice(0, 2000))
  const { data: qs, error } = await q.limit(5000)
  if (error) redirect(comAviso(volta, 'erro', SEM_TEMAS))
  // por especialidade: cada questão concorre só com os temas da especialidade dela (pela disciplina ou pelo assunto atual, como "Anestesiologia")
  const lotes = new Map<string, { id: string; texto: string }[]>()
  for (const x of (qs ?? []) as any[]) {
    const texto = textoDosBlocos((x.blocos ?? []) as Bloco[]) + ' ' + ((x.alternativas ?? []) as { texto: string }[]).map(a => a.texto).join(' ')
    const esps = [x.disciplines?.nome, x.assunto].filter(Boolean).map((v: string) => normalizar(v))
    const esp = [...new Set(temas.map(t => normalizar(t.especialidade)))].find(e => esps.includes(e)) ?? '*'
    lotes.set(esp, [...(lotes.get(esp) ?? []), { id: x.id, texto }])
  }
  const porTema = new Map<string, string[]>()
  for (const [esp, questoes] of lotes) {
    const cands = esp === '*' ? temas : temas.filter(t => normalizar(t.especialidade) === esp)
    for (const [qid, t] of sugerirTemas(questoes, cands)) porTema.set(t.id, [...(porTema.get(t.id) ?? []), qid])
  }
  let n = 0
  for (const [id, ids] of porTema) n += (await gravarTema(sb, ids, temas.find(t => t.id === id)!)).n
  refresh()
  const sem = (qs ?? []).length - n
  redirect(comAviso(volta, n ? 'ok' : 'erro', n ? `Tema encontrado para ${n} ${n === 1 ? 'questão' : 'questões'}${sem ? `; ${sem} ${sem === 1 ? 'ficou' : 'ficaram'} sem tema (escolha à mão)` : ''}. Confira e publique de novo.`
    : (qs ?? []).length ? `Não achei o tema de nenhuma das ${(qs ?? []).length} questões sem tema. Dê palavras-chave aos temas (Lista de temas: remédios, exames, achados típicos) e tente de novo, ou escolha à mão.`
      : 'Nenhuma questão sem tema para sugerir (nas marcadas ou nos filtros).'))
}
