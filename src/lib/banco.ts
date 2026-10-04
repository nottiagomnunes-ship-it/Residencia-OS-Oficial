'use server'
import { createHash } from 'crypto'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { validarLote, textoParaHash, lerFiltros, sortear, nomeDaLista, rotuloDosAnos, SEM_ASSUNTO } from '@/lib/engine/banco'
import { textoDosBlocos, ehLetra, type Alternativa, type Bloco } from '@/lib/engine/provas'
import { sugerirArea, normalizar, lerArea } from '@/lib/engine/areas'
import { lerPdfComFiguras } from '@/lib/pdf-figuras'
import { MARCA_FIGURA } from '@/lib/engine/provas-pdf'
import { aplicarFiltros, assuntoDoFiltro, SO_ADMIN, ehAdmin, carregarTemas, aplicarFiltroAdmin, lerFiltroAdmin, hashesReportados } from '@/lib/banco-data'
import { lerListaDeTemas, sugerirTemas, type Tema } from '@/lib/engine/temas'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
/** Para onde voltar depois de um formulário da lista do banco: só para a própria página (com os filtros), nunca para fora do app. */
const voltaDoBanco = (fd: FormData) => { const v = String(fd.get('volta') || ''); return /^\/(banco(\/questoes)?|admin(\/questoes(\/[0-9a-f-]{36})?)?)(\?[^\s]*)?$/.test(v) ? v : '/admin/questoes' }
const SEM_TABELA = 'Falta atualizar o banco: rode supabase/migrations/0034_banco_questoes.sql no SQL Editor do Supabase.'
const semTabela = (e: { code?: string; message?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || /does not exist|schema cache/i.test(e.message ?? ''))
const refresh = () => ['/banco', '/questoes', '/desempenho', '/caderno-de-erros', '/inicio'].forEach(p => revalidatePath(p, 'layout'))

/** O texto do PDF, página por página (o navegador monta as questões e mostra a prévia). */
/**
 * Lê o PDF de questões: o texto de cada página, com as figuras no lugar. As figuras já são guardadas aqui (na pasta da conta), porque mandar
 * todas de volta para o navegador passaria do limite de tamanho da resposta; volta o caminho e um link temporário para a prévia.
 */
const MAX_PDF = 30 * 1024 * 1024 // PDF de questões grande (vai pelo armazenamento "importacao", 0044)
export async function lerPdfDeQuestoes(fd: FormData): Promise<{ paginas?: string[]; figuras?: Record<string, { caminho: string; url: string | null }>; avisoFiguras?: string; erro?: string }> {
  const { sb, uid } = await ctx()
  if (!(await ehAdmin(sb))) return { erro: SO_ADMIN }
  // PDF pequeno vem no próprio formulário; o grande (o envio direto tem limite de ~4 MB) o navegador põe antes na pasta temporária da conta
  const f = fd.get('pdf'), temp = String(fd.get('caminho') || '')
  let dados: Uint8Array
  if (temp) {
    if (!new RegExp(`^${uid}/[0-9a-f-]{36}\\.pdf$`).test(temp)) return { erro: 'Arquivo inválido.' }
    const { data: blob, error } = await sb.storage.from('importacao').download(temp)
    await sb.storage.from('importacao').remove([temp]).catch(() => {})
    if (error || !blob) return { erro: 'Não consegui receber o PDF. Se for a primeira vez com um PDF grande, rode supabase/migrations/0044_importacao_pdf_grande.sql no SQL Editor do Supabase.' }
    if (blob.size > MAX_PDF) return { erro: 'O PDF passa de 30 MB. Divida o arquivo em partes menores.' }
    dados = new Uint8Array(await blob.arrayBuffer())
  } else {
    if (!(f instanceof File) || f.size === 0) return { erro: 'Selecione um arquivo PDF.' }
    if (f.size > 4 * 1024 * 1024) return { erro: 'O PDF passa de 4 MB por este caminho. Recarregue a página e tente de novo.' }
    dados = new Uint8Array(await f.arrayBuffer())
  }
  let paginas: string[], lidas: Awaited<ReturnType<typeof lerPdfComFiguras>>['figuras'] = {}, avisoFiguras: string | undefined
  try {
    ({ paginas, figuras: lidas } = await lerPdfComFiguras(dados.slice()))
  } catch { // se a leitura das figuras falhar, segue só com o texto
    try {
      const { extractText, getDocumentProxy } = await import('unpdf')
      const { text } = await extractText(await getDocumentProxy(dados.slice()), { mergePages: false })
      paginas = (Array.isArray(text) ? text : [text]).map(t => String(t))
      avisoFiguras = 'Não consegui tirar as figuras deste PDF; as questões vieram só com o texto.'
    } catch { return { erro: 'Não consegui ler esse PDF.' } }
  }
  if (paginas.join('').split('\n').filter(l => !l.startsWith(MARCA_FIGURA)).join('').trim().length < 50) return { erro: 'Não consegui extrair texto: o PDF parece ser uma imagem escaneada.' }
  const st = sb.storage.from('provas'), figuras: Record<string, { caminho: string; url: string | null }> = {}
  const lista = Object.entries(lidas)
  for (let i = 0; i < lista.length; i += 6) await Promise.all(lista.slice(i, i + 6).map(async ([nome, fig]) => { // 6 de cada vez
    const caminho = `${uid}/banco/${crypto.randomUUID()}.${fig.ext}`
    const { error } = await st.upload(caminho, fig.bytes, { contentType: fig.tipo, upsert: false })
    if (error) avisoFiguras = 'Algumas figuras não puderam ser guardadas; essas questões vieram sem a figura.'
    else figuras[nome] = { caminho, url: null }
  }))
  const caminhos = Object.values(figuras).map(x => x.caminho)
  if (caminhos.length) {
    const { data } = await st.createSignedUrls(caminhos, 60 * 60 * 6)
    const url = new Map((data ?? []).map(d => [d.path, d.signedUrl]))
    for (const x of Object.values(figuras)) x.url = url.get(x.caminho) ?? null
  }
  return { paginas, figuras, ...(avisoFiguras ? { avisoFiguras } : {}) }
}

/** Grava o lote: confere, calcula a impressão digital de cada questão e deixa o banco ignorar as repetidas. */
export async function importarNoBanco(dados: unknown, publicar: { colecao: string | null } | null = null, opcoes: { criarTemas?: boolean } = {}):
  Promise<{ ok: true; novas: number; repetidas: number; publicacao?: string; erroPublicacao?: string; temas?: string; explicacoes?: string; figuras?: string } | { ok: false; erro: string }> {
  const { sb, uid } = await ctx()
  if (!(await ehAdmin(sb))) return { ok: false, erro: SO_ADMIN }
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
  // as deste arquivo no banco (novas e as que já estavam), pela impressão digital
  const idPorHash = new Map<string, string>()
  if (publicar || itens.some(q => q.tema || q.explicacao)) for (let i = 0; i < itens.length; i += 200) {
    const { data } = await sb.from('banco_questoes').select('id,hash').in('hash', itens.slice(i, i + 200).map(q => q.hash))
    for (const q of (data ?? []) as { id: string; hash: string }[]) idPorHash.set(q.hash, q.id)
  }
  const temas = itens.some(q => q.tema) ? await aplicarTemasDoLote(sb, itens, idPorHash, !!opcoes.criarTemas) : undefined
  const explicacoes = itens.some(q => q.explicacao) ? await aplicarExplicacoesDoLote(sb, itens, idPorHash) : undefined
  const figuras = novas < itens.length && itens.some(temFigura) ? await aplicarFigurasDoLote(sb, itens) : undefined
  const extras = { ...(temas ? { temas } : {}), ...(explicacoes ? { explicacoes } : {}), ...(figuras ? { figuras } : {}) }
  if (!publicar) return { ok: true, novas, repetidas: itens.length - novas, ...extras }
  // "Publicar também no banco geral" (depois dos temas, para o tema ir junto)
  const ids = [...new Set(idPorHash.values())]
  const r = await publicarIds(sb, ids, publicar.colecao?.trim().slice(0, 120) || null)
  return r.ok ? { ok: true, novas, repetidas: itens.length - novas, publicacao: resumoDaPublicacao(r), ...extras }
    : { ok: true, novas, repetidas: itens.length - novas, ...extras, erroPublicacao: `As questões entraram no seu banco, mas a publicação falhou: ${r.erro} Publique pelo Banco → Organizar.` }
}

const temFigura = (q: { blocos: Bloco[] }) => q.blocos.some(b => b.tipo === 'imagem')

/**
 * Questões do arquivo que JÁ estavam no banco sem nenhuma figura (ex.: vieram antes de um PDF lido só como texto) e agora vêm com figura:
 * passam a ter as figuras do arquivo (o texto é o mesmo, pela impressão digital). As que já tinham figura ficam como estão.
 */
async function aplicarFigurasDoLote(sb: Awaited<ReturnType<typeof supabaseServer>>, itens: { hash: string; blocos: Bloco[] }[]) {
  const comFigura = new Map(itens.filter(temFigura).map(q => [q.hash, q.blocos]))
  let n = 0
  const hashes = [...comFigura.keys()]
  for (let i = 0; i < hashes.length; i += 200) {
    const { data } = await sb.from('banco_questoes').select('id,hash,blocos').in('hash', hashes.slice(i, i + 200))
    for (const q of (data ?? []) as { id: string; hash: string; blocos: Bloco[] }[]) {
      if (temFigura({ blocos: q.blocos ?? [] })) continue
      const { error } = await sb.from('banco_questoes').update({ blocos: comFigura.get(q.hash) }).eq('id', q.id)
      if (!error) n++
    }
  }
  return n ? `${n} ${n === 1 ? 'questão que já estava no banco ganhou a figura' : 'questões que já estavam no banco ganharam as figuras'}.` : undefined
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

// ---------- Banco geral ----------

const comAviso = (volta: string, tipo: 'ok' | 'erro', msg: string) => `${volta}${volta.includes('?') ? '&' : '?'}${tipo}=${encodeURIComponent(msg)}`
const SEM_GERAL = 'Falta atualizar o banco: rode supabase/migrations/0037_banco_geral.sql no SQL Editor do Supabase.'

/** As questões escolhidas no formulário: as marcadas, ou (com "todas") todas as dos filtros da página, até 2000. */
async function idsDoFormulario(sb: Awaited<ReturnType<typeof supabaseServer>>, fd: FormData) {
  if (fd.get('todas') !== '1') return fd.getAll('sel').map(String).filter(x => /^[0-9a-f-]{36}$/i.test(x))
  const ps = Object.fromEntries(new URLSearchParams(String(fd.get('filtros') || ''))), f = lerFiltros(ps), adm = lerFiltroAdmin(ps.adm)
  const base = aplicarFiltros(sb.from('banco_questoes').select('id'), f, await assuntoDoFiltro(sb, f))
  const { data } = await aplicarFiltroAdmin(base, adm, adm === 'reportadas' ? await hashesReportados(sb) : []).limit(2000)
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

// ---------- Temas (lista geral: só etiqueta das questões, não mexe em Matérias nem no plano de ninguém) ----------

const SEM_TEMAS = 'Falta atualizar o banco: rode supabase/migrations/0040_temas.sql no SQL Editor do Supabase.'
const voltaDosTemas = (fd: FormData) => { const v = String(fd.get('volta') || ''); return /^\/(banco\/(temas|questoes)|admin\/(temas|questoes))(\?[^\s]*)?$/.test(v) ? v : '/admin/temas' }

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

/**
 * Importação com tema (pacote classificado): liga cada questão ao tema da Lista de temas pelo nome (especialidade + tema, sem ligar para
 * acento e maiúscula), criando os que faltam se `criar`. Vale também para as que já estavam no banco (mesmo texto). Só a administradora.
 * Devolve a frase do resultado.
 */
async function aplicarTemasDoLote(sb: Awaited<ReturnType<typeof supabaseServer>>, itens: { hash: string; tema?: { especialidade: string; nome: string } | null }[],
  idPorHash: Map<string, string>, criar: boolean): Promise<string> {
  if (!(await ehAdmin(sb))) return 'Os temas do arquivo foram ignorados: só a conta administradora aplica temas.'
  let lista = await carregarTemas(sb)
  const chave = (t: { especialidade: string; nome: string }) => normalizar(t.especialidade) + '|' + normalizar(t.nome)
  const porChave = () => new Map(lista.map(t => [chave(t), t]))
  let mapa = porChave()
  const faltam = [...new Map(itens.flatMap(i => (i.tema && !mapa.has(chave(i.tema)) ? [[chave(i.tema), i.tema] as const] : []))).values()]
  let criados = 0
  if (faltam.length && criar) {
    const { error } = await sb.from('temas').insert(faltam.map(t => ({ especialidade: t.especialidade, nome: t.nome, area: sugerirArea(t.especialidade) })))
    if (!error) { criados = faltam.length; lista = await carregarTemas(sb); mapa = porChave() }
  }
  const grupos = new Map<string, string[]>()
  for (const i of itens) {
    const t = i.tema ? mapa.get(chave(i.tema)) : undefined, id = idPorHash.get(i.hash)
    if (t && id) grupos.set(t.id, [...(grupos.get(t.id) ?? []), id])
  }
  let n = 0
  for (const [tid, ids] of grupos) n += (await gravarTema(sb, [...new Set(ids)], lista.find(t => t.id === tid)!)).n
  const sem = itens.filter(i => i.tema).length - n
  return `Tema aplicado em ${n} ${n === 1 ? 'questão' : 'questões'}` + (criados ? ` (${criados} ${criados === 1 ? 'tema novo criado' : 'temas novos criados'} na lista)` : '') +
    (sem > 0 ? `; ${sem} ${sem === 1 ? 'ficou' : 'ficaram'} sem tema${faltam.length && !criar ? ' (temas que não estão na lista)' : ''}` : '') + '.'
}

// ---------- Explicações (texto original: IA ou revisado pela administradora; vai para o banco geral, diferente do comentário) ----------

const SEM_EXPLICACOES = 'Falta atualizar o banco: rode supabase/migrations/0042_explicacoes.sql no SQL Editor do Supabase.'

/** Importação com explicação (pacote preparado fora do app): grava a explicação em cada questão, inclusive nas que já estavam no banco. */
async function aplicarExplicacoesDoLote(sb: Awaited<ReturnType<typeof supabaseServer>>, itens: { hash: string; explicacao?: { texto: string; origem: 'ia' | 'revisada' } | null }[],
  idPorHash: Map<string, string>): Promise<string> {
  const alvo = itens.flatMap(i => (i.explicacao && idPorHash.get(i.hash) ? [{ id: idPorHash.get(i.hash)!, e: i.explicacao }] : []))
  let n = 0, falhou = false
  for (let i = 0; i < alvo.length && !falhou; i += 20) {
    const rs = await Promise.all(alvo.slice(i, i + 20).map(x => sb.from('banco_questoes').update({ explicacao: x.e.texto, explicacao_origem: x.e.origem }).eq('id', x.id)))
    for (const r of rs) { if (r.error) falhou = true; else n++ }
  }
  if (falhou && !n) return SEM_EXPLICACOES
  return `Explicação gravada em ${n} ${n === 1 ? 'questão' : 'questões'}.`
}

/** Administradora: escreve, corrige ou apaga a explicação de uma questão do próprio banco (fica "revisada"). Publique de novo para chegar às outras contas. */
export async function salvarExplicacao(id: string, texto: string): Promise<{ ok: boolean; erro?: string }> {
  const { sb } = await ctx()
  if (!(await ehAdmin(sb))) return { ok: false, erro: SO_ADMIN }
  const t = texto.trim().slice(0, 8000)
  const { error } = await sb.from('banco_questoes').update({ explicacao: t || null, explicacao_origem: t ? 'revisada' : null }).eq('id', id)
  if (error) return { ok: false, erro: /explicacao/.test(error.message) ? SEM_EXPLICACOES : 'Não foi possível salvar.' }
  refresh()
  return { ok: true }
}

/** Quem estuda: reporta erro na explicação de uma questão (vai para a administradora conferir). */
export async function reportarExplicacao(id: string, motivo: string): Promise<{ ok: boolean; erro?: string }> {
  const { sb, uid } = await ctx()
  const m = motivo.trim().slice(0, 1000)
  if (m.length < 3) return { ok: false, erro: 'Conte em poucas palavras o que está errado.' }
  const { data: q } = await sb.from('banco_questoes').select('hash,origem_geral').eq('id', id).maybeSingle()
  if (!q) return { ok: false, erro: 'Questão não encontrada.' }
  const { error } = await sb.from('explicacao_reportes').insert({ user_id: uid, hash: q.hash, geral_id: q.origem_geral ?? null, motivo: m })
  return error ? { ok: false, erro: 'Não foi possível enviar. Tente de novo.' } : { ok: true }
}

/** Administradora: marca um reporte como resolvido. */
export async function resolverReporte(fd: FormData) {
  const { sb } = await ctx()
  const volta = voltaDoBanco(fd)
  await sb.from('explicacao_reportes').update({ resolvido_em: new Date().toISOString() }).eq('id', String(fd.get('id') || ''))
  refresh()
  redirect(comAviso(volta, 'ok', 'Reporte marcado como resolvido. Se corrigiu a explicação, publique a questão de novo.'))
}

// ---------- Administração: editar uma questão ----------

/** Volta para a página de edição de uma questão (com os parâmetros da lista), nunca para fora do app. */
const voltaDaEdicao = (fd: FormData, id: string) => {
  const v = String(fd.get('volta') || '')
  return v.startsWith(`/admin/questoes/${id}`) && /^[^\s]*$/.test(v) ? v : `/admin/questoes/${id}`
}

/**
 * Administradora: salva tudo de uma questão numa vez só (enunciado, alternativas, gabarito, anulada, banca, ano, tema, explicação e comentário).
 * As figuras ficam como estão. Se o texto muda, a impressão digital é refeita (não pode ficar igual à de outra questão sua).
 * Com intencao=publicar, publica (ou atualiza) no banco geral logo depois.
 */
export async function salvarQuestao(fd: FormData) {
  const { sb, uid } = await ctx()
  const id = String(fd.get('id') || '')
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect('/admin/questoes')
  const volta = voltaDaEdicao(fd, id)
  if (!(await ehAdmin(sb))) redirect(comAviso(volta, 'erro', 'Só a conta administradora edita as questões aqui.'))
  const { data: q, error: e0 } = await sb.from('banco_questoes').select('id,hash,blocos,alternativas,gabarito,gabarito_origem,anulada,banca,ano,tema_id,explicacao,explicacao_origem,comentario,origem_geral').eq('id', id).maybeSingle()
  if (e0) redirect(comAviso(volta, 'erro', 'Falta atualizar o banco: rode as migrations até a 0043_admin_pendencias.sql no SQL Editor do Supabase.'))
  if (!q) redirect(comAviso('/admin/questoes', 'erro', 'Questão não encontrada.'))

  // enunciado: o texto de cada bloco de texto (bloco_0, bloco_1…); um bloco de texto apagado sai. Figuras: "remover_figura" = índice
  // de uma figura que sai; "figura_nova" = "depois de qual bloco|caminho" (já enviada para o armazenamento, na pasta da conta)
  const remover = new Set(fd.getAll('remover_figura').map(Number))
  const novas = fd.getAll('figura_nova').map(String).map(v => { const [p, c] = v.split('|'); return { depoisDe: Number(p), caminho: c } })
    .filter(n => Number.isInteger(n.depoisDe) && new RegExp(`^${uid}/banco/[0-9a-f-]{36}\\.(png|jpg|jpeg|gif|webp)$`).test(n.caminho ?? ''))
  const blocos: Bloco[] = [], depois = (k: number) => novas.filter(n => n.depoisDe === k).forEach(n => blocos.push({ tipo: 'imagem', caminho: n.caminho }))
  depois(-1)
  ;((q.blocos ?? []) as Bloco[]).forEach((b, k) => {
    if (b.tipo !== 'texto') { if (!remover.has(k)) blocos.push(b) }
    else {
      const t = fd.has(`bloco_${k}`) ? String(fd.get(`bloco_${k}`)).replace(/\r\n/g, '\n').trim().slice(0, 20000) : b.texto
      if (t) blocos.push({ ...b, texto: t })
    }
    depois(k)
  })
  const ultimo = ((q.blocos ?? []) as Bloco[]).length - 1
  novas.filter(n => n.depoisDe > ultimo).forEach(n => blocos.push({ tipo: 'imagem', caminho: n.caminho }))
  if (!blocos.some(b => b.tipo === 'texto')) redirect(comAviso(volta, 'erro', 'O enunciado não pode ficar vazio.'))

  // alternativas: as letras e os textos na ordem; uma alternativa sem texto sai
  const letras = fd.getAll('alt_letra').map(x => String(x).trim().toUpperCase()), textos = fd.getAll('alt_texto').map(x => String(x).trim().slice(0, 4000))
  const alternativas = letras.map((letra, k) => ({ letra, texto: textos[k] ?? '' })).filter((a): a is Alternativa => ehLetra(a.letra) && !!a.texto)
  if (new Set(alternativas.map(a => a.letra)).size !== alternativas.length) redirect(comAviso(volta, 'erro', 'Duas alternativas com a mesma letra.'))
  if (alternativas.length < 2) redirect(comAviso(volta, 'erro', 'A questão precisa de pelo menos duas alternativas.'))

  const gab = String(fd.get('gabarito') || '').trim().toUpperCase() || null
  if (gab && !alternativas.some(a => a.letra === gab)) redirect(comAviso(volta, 'erro', `O gabarito ${gab} não é uma das alternativas.`))
  const anoTxt = String(fd.get('ano') || '').trim(), ano = anoTxt ? Number(anoTxt) : null
  if (ano !== null && !(Number.isInteger(ano) && ano >= 1950 && ano <= 2100)) redirect(comAviso(volta, 'erro', 'Ano inválido.'))
  const expl = String(fd.get('explicacao') ?? q.explicacao ?? '').replace(/\r\n/g, '\n').trim().slice(0, 8000) || null
  const coment = String(fd.get('comentario') ?? q.comentario ?? '').replace(/\r\n/g, '\n').trim().slice(0, 20000) || null

  const hash = createHash('sha256').update(textoParaHash(blocos, alternativas)).digest('hex')
  if (hash !== q.hash) {
    const { data: igual } = await sb.from('banco_questoes').select('id').eq('hash', hash).neq('id', id).limit(1)
    if ((igual ?? []).length) redirect(comAviso(volta, 'erro', 'Com esse texto, ela fica igual a outra questão do seu banco. Nada foi salvo.'))
  }
  const muda: Record<string, unknown> = {
    blocos, alternativas, hash, anulada: fd.get('anulada') === '1',
    gabarito: gab, gabarito_origem: gab === q.gabarito ? q.gabarito_origem : gab ? 'oficial' : null,
    banca: String(fd.get('banca') || '').trim().slice(0, 120) || null, ano, comentario: coment,
  }
  if (expl !== (q.explicacao ?? null)) Object.assign(muda, { explicacao: expl, explicacao_origem: expl ? 'revisada' : null })
  const { error } = await sb.from('banco_questoes').update(muda).eq('id', id)
  if (error) redirect(comAviso(volta, 'erro', /explicacao/.test(error.message) ? SEM_EXPLICACOES : 'Não foi possível salvar. Tente de novo.'))
  // os reportes abertos seguem a questão (eles a acham pela impressão digital)
  if (hash !== q.hash) await sb.from('explicacao_reportes').update({ hash }).eq('hash', q.hash).is('resolvido_em', null)

  // tema (com o assunto e a disciplina que vêm dele)
  const temaId = String(fd.get('tema') ?? (q.tema_id ?? ''))
  if (temaId !== (q.tema_id ?? '')) {
    const tema = temaId ? (await carregarTemas(sb)).find(t => t.id === temaId) ?? null : null
    if (temaId && !tema) redirect(comAviso(volta, 'erro', 'Salvo, mas o tema escolhido não foi encontrado.'))
    if (!(await gravarTema(sb, [id], tema)).ok) redirect(comAviso(volta, 'erro', 'Salvo, mas sem o tema: ' + SEM_TEMAS))
  }
  refresh(); revalidatePath('/admin', 'layout')

  if (fd.get('intencao') === 'publicar') {
    const r = await publicarIds(sb, [id], null)
    if (!r.ok) redirect(comAviso(volta, 'erro', `Salvo no seu banco, mas não publicado: ${r.erro}`))
    redirect(comAviso(volta, 'ok', r.novas ? 'Salvo e publicado no banco geral.' : 'Salvo e atualizado no banco geral. As outras contas recebem ao abrir Praticar ou Banco.'))
  }
  redirect(comAviso(volta, 'ok', q.origem_geral ? 'Salvo. Para chegar às outras contas, use "Salvar e publicar".' : 'Salvo.'))
}

/** Administradora: exclui uma questão do próprio banco pela página de edição e volta para a lista. */
export async function excluirQuestaoDaAdmin(fd: FormData) {
  const { sb } = await ctx()
  const id = String(fd.get('id') || ''), lista = String(fd.get('lista') || '')
  await sb.from('banco_questoes').delete().eq('id', id)
  refresh(); revalidatePath('/admin', 'layout')
  redirect(comAviso(/^\/admin\/questoes(\?[^\s]*)?$/.test(lista) ? lista : '/admin/questoes', 'ok', 'Questão excluída do seu banco. Se ela estava no banco geral, continua lá até você tirá-la.'))
}
