'use server'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { xpSimulado } from '@/lib/engine/simulados'
import { xpQuestoes } from '@/lib/engine/questoes'
import { ehArea } from '@/lib/engine/areas'
import { MOTIVOS } from '@/lib/engine/questoes'
import {
  validarProvaImportada, lerGabarito, itensDoGabarito, faixas, corrigir, textoParaCaderno, ehLetra, ehUuid, type Letra,
} from '@/lib/engine/provas'
import { carregarProva, caminhosDasFiguras, BUCKET } from '@/lib/provas-data'
import { carregarGamificacao } from '@/lib/gamificacao-data'
import { resolverAlvo } from '@/lib/xp'

async function ctx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  return { sb, uid: user.id }
}
const refresh = () => ['/provas', '/simulados', '/questoes', '/caderno-de-erros', '/desempenho', '/inicio', '/calendario', '/metas'].forEach(p => revalidatePath(p, 'layout'))
const com = (url: string, k: string, v: string) => `${url}${url.includes('?') ? '&' : '?'}${k}=${encodeURIComponent(v)}`
const SEM_TABELA = 'Falta atualizar o banco: rode supabase/migrations/0028_provas.sql no SQL Editor do Supabase.'
const semTabela = (e: { code?: string; message?: string } | null) => !!e && (e.code === '42P01' || e.code === 'PGRST205' || e.code === 'PGRST202' || /does not exist|schema cache/i.test(e.message ?? ''))

/** Grava a prova importada (as figuras já foram enviadas pelo navegador para a pasta da pessoa). */
export async function salvarProva(dados: unknown): Promise<{ ok: true; id: string } | { ok: false; erro: string }> {
  const { sb, uid } = await ctx()
  const v = validarProvaImportada(dados, uid)
  if (!v.ok) return v
  const { id, nome, banca, ano, questoes } = v.prova
  const { error } = await sb.rpc('salvar_prova', { p_prova: { id, nome, banca, ano }, p_questoes: questoes })
  if (error) return { ok: false, erro: semTabela(error) ? SEM_TABELA : 'Não foi possível gravar a prova. Nada foi salvo; tente de novo.' }
  refresh()
  return { ok: true, id }
}

/** Lê o gabarito colado e grava só as questões encontradas. Com `tentativa`, tenta corrigir logo em seguida. */
export async function salvarGabarito(fd: FormData) {
  const { sb } = await ctx()
  const provaId = String(fd.get('prova')), tentativa = String(fd.get('tentativa') || '')
  const volta = ehUuid(tentativa) ? `/provas/tentativa/${tentativa}` : `/provas/${provaId}`
  if (!ehUuid(provaId)) redirect('/provas')
  const { data: qs, error } = await sb.from('prova_questoes').select('numero,alternativas').eq('prova_id', provaId).order('numero')
  if (error || !qs?.length) redirect(com(volta, 'erro', error && semTabela(error) ? SEM_TABELA : 'Prova não encontrada.'))
  const lido = lerGabarito(String(fd.get('gabarito') ?? ''), qs.map(q => q.numero))
  const { itens, invalidas } = itensDoGabarito(qs.map(q => ({ numero: q.numero, alternativas: Array.isArray(q.alternativas) ? q.alternativas.length : 0 })), lido.respostas)
  if (!itens.length) redirect(com(volta, 'erro', 'Não encontrei nenhuma resposta no texto. Exemplo: 1-A 2-C 3-B (ou só as letras em sequência).'))
  const { error: e2 } = await sb.rpc('atualizar_questoes_da_prova', { p_prova: provaId, p_itens: itens })
  if (e2) redirect(com(volta, 'erro', 'Não foi possível gravar o gabarito. Tente de novo.'))
  const avisos = [invalidas.length ? `letra que não existe na questão: ${faixas(invalidas)}` : '', lido.fora.length ? `números fora da prova: ${faixas(lido.fora)}` : ''].filter(Boolean)
  refresh()
  if (ehUuid(tentativa)) {
    const r = await corrigirTentativa(tentativa)
    if (r === 'falta') redirect(com(volta, 'erro', `Gabarito gravado (${itens.length}), mas ainda faltam questões para poder corrigir.${avisos.length ? ' Ignorei: ' + avisos.join('; ') + '.' : ''}`))
    if (r !== 'ok') redirect(com(volta, 'erro', r))
    redirect(com(volta, 'ok', 'corrigida'))
  }
  redirect(com(volta, avisos.length ? 'erro' : 'ok', `Gabarito gravado: ${itens.length} questões.${avisos.length ? ' Ignorei: ' + avisos.join('; ') + '.' : ''}`))
}

/** Dá uma área a uma faixa de questões ("de 1 a 20: Preventiva"). Área vazia tira a área. */
export async function definirAreaPorFaixa(fd: FormData) {
  const { sb } = await ctx()
  const provaId = String(fd.get('prova')), de = Number(fd.get('de')), ate = Number(fd.get('ate')), area = String(fd.get('area') || '')
  if (!ehUuid(provaId)) redirect('/provas')
  const volta = `/provas/${provaId}`
  if (!Number.isInteger(de) || !Number.isInteger(ate) || de < 1 || ate < de) redirect(com(volta, 'erro', 'Confira a faixa: "de" precisa ser menor ou igual a "até".'))
  if (area && !ehArea(area)) redirect(volta)
  const itens = Array.from({ length: Math.min(ate - de + 1, 999) }, (_, i) => ({ numero: de + i, area: area || null }))
  const { data: n, error } = await sb.rpc('atualizar_questoes_da_prova', { p_prova: provaId, p_itens: itens })
  if (error) redirect(com(volta, 'erro', 'Não foi possível gravar as áreas.'))
  refresh()
  redirect(com(volta, 'ok', `Área atualizada em ${n ?? 0} questões.`))
}

/** Começa a prova ou continua a tentativa aberta. */
export async function iniciarTentativa(fd: FormData) {
  const { sb } = await ctx()
  const provaId = String(fd.get('prova'))
  const { data: id, error } = await sb.rpc('iniciar_tentativa', { p_prova: provaId })
  if (error || !id) redirect(com('/provas', 'erro', error && semTabela(error) ? SEM_TABELA : 'Não foi possível abrir a prova.'))
  redirect(`/provas/tentativa/${id}`)
}

export type RespostaParaGravar = { alternativa: Letra | null; chute: boolean; marcada: boolean; riscadas: string }
/**
 * Grava uma resposta durante a prova (ou só o tempo, sem questão). Chamado pela tela da prova, sem recarregar a página.
 * `status` diferente de "ok" quer dizer que a prova já foi entregue (em outro aparelho, por exemplo).
 */
export async function responderQuestao(tentativa: string, questao: string | null, r: RespostaParaGravar | null, tempoSeg: number, atual: number)
  : Promise<{ ok: true; status: string } | { ok: false; sessao?: boolean }> {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return { ok: false, sessao: true }
  if (!ehUuid(tentativa) || (questao !== null && !ehUuid(questao))) return { ok: false }
  const riscadas = [...new Set(String(r?.riscadas ?? '').toUpperCase().replace(/[^A-E]/g, ''))].sort().join('')
  const { data, error } = await sb.rpc('responder_questao', {
    p_tentativa: tentativa, p_questao: questao, p_alt: r && ehLetra(r.alternativa) ? r.alternativa : null, p_chute: !!r?.chute, p_marcada: !!r?.marcada,
    p_riscadas: riscadas, p_tempo: Math.max(0, Math.floor(Number(tempoSeg) || 0)), p_atual: Number.isInteger(atual) ? atual : null,
  })
  if (error) return { ok: false }
  return { ok: true, status: String(data) }
}

/** Entrega a prova e já corrige, se o gabarito estiver completo. */
export async function entregarProva(tentativa: string, tempoSeg: number) {
  const { sb } = await ctx()
  if (!ehUuid(tentativa)) redirect('/provas')
  await sb.rpc('entregar_tentativa', { p_tentativa: tentativa, p_tempo: Math.max(0, Math.floor(Number(tempoSeg) || 0)) })
  const r = await corrigirTentativa(tentativa)
  refresh()
  if (r === 'ok') redirect(`/provas/tentativa/${tentativa}?ok=corrigida`)
  if (r === 'falta') redirect(`/provas/tentativa/${tentativa}`)
  redirect(com(`/provas/tentativa/${tentativa}`, 'erro', r))
}

/**
 * Corrige uma tentativa entregue: calcula aqui (mesmas regras dos testes), monta o texto de cada questão para o caderno e grava tudo numa
 * transação no banco, que refaz a conta. Devolve "ok", "falta" (gabarito incompleto) ou a mensagem de erro.
 */
async function corrigirTentativa(tentativa: string): Promise<string> {
  const sb = await supabaseServer()
  const { data: t } = await sb.from('prova_tentativas').select('id,prova_id,status').eq('id', tentativa).maybeSingle()
  if (!t) return 'Tentativa não encontrada.'
  if (t.status === 'corrigida') return 'ok'
  if (t.status !== 'entregue') return 'A prova ainda não foi entregue.'
  const dados = await carregarProva(sb, t.prova_id, false)
  if (!dados) return 'Prova não encontrada.'
  const { data: rs } = await sb.from('prova_respostas').select('questao_id,alternativa,chute').eq('tentativa_id', tentativa)
  const respostas = Object.fromEntries((rs ?? []).map(r => [r.questao_id, { alternativa: ehLetra(r.alternativa) ? r.alternativa : null, chute: !!r.chute }]))
  const c = corrigir(dados.questoes, respostas)
  if (c.semGabarito.length) return 'falta'
  if (c.total < 1) return 'Todas as questões estão anuladas: não há o que corrigir.'
  const porId = new Map(dados.questoes.map(q => [q.id, q]))
  const textos = Object.fromEntries(c.itens.filter(i => i.vaiProCaderno).map(i => {
    const q = porId.get(i.id)!
    return [i.id, textoParaCaderno(dados.prova.nome, { numero: q.numero, alternativas: q.alternativas, blocos: q.blocos.map(b => (b.tipo === 'imagem' ? { tipo: 'imagem' as const, caminho: b.caminho } : b)) }, i.alternativa, i.gabarito)]
  }))
  // lista do banco: o resultado vai para as questões (Desempenho por assunto) com o XP de "Registrar questões"; prova: para Simulados
  const lista = dados.prova.tipo === 'lista'
  const { error } = await sb.rpc(lista ? 'corrigir_lista' : 'corrigir_tentativa', { p_tentativa: tentativa, p_dia: hojeBR(), p_xp: lista ? xpQuestoes(c.total, c.acertos) : xpSimulado(c.total, c.acertos), p_total: c.total, p_acertos: c.acertos, p_textos: textos })
  if (error) return /mudou/.test(error.message) ? 'O gabarito mudou durante a correção. Recarregue a página e tente de novo.' : 'Não foi possível corrigir. Nada foi gravado; tente de novo.'
  if (lista) { // acertos no chute também vão para "refazer" (os erros já vão sozinhos)
    const ids = c.itens.filter(i => i.chute && i.situacao === 'certa').map(i => i.id)
    if (ids.length) {
      const { data: qs } = await sb.from('prova_questoes').select('banco_questao_id').in('id', ids)
      const chutes = (qs ?? []).map(q => q.banco_questao_id as string | null).filter((x): x is string => !!x)
      if (chutes.length) await sb.rpc('refazer_chutes', { p_ids: chutes })
    }
  }
  await carregarGamificacao(sb, hojeBR()).catch(() => {})
  return 'ok'
}

/** Na correção: o motivo do erro e a disciplina/assunto. A disciplina também fica guardada na questão da prova (para as próximas tentativas). */
export async function classificarErro(erroId: string, dados: { motivo?: string | null; alvo?: string | null }): Promise<{ ok: boolean }> {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user || !ehUuid(erroId)) return { ok: false }
  const muda: Record<string, unknown> = {}
  if (dados.motivo !== undefined) { if (dados.motivo !== null && !(dados.motivo in MOTIVOS)) return { ok: false }; muda.motivo = dados.motivo }
  let alvo: { topic_id: string | null; discipline_id: string | null } | null = null
  if (dados.alvo !== undefined) { alvo = dados.alvo ? await resolverAlvo(sb, dados.alvo) : { topic_id: null, discipline_id: null }; Object.assign(muda, alvo) }
  if (!Object.keys(muda).length) return { ok: true }
  const { error } = await sb.from('error_notebook').update(muda).eq('id', erroId)
  if (error) return { ok: false }
  if (alvo) {
    const { data: r } = await sb.from('prova_respostas').select('questao_id').eq('erro_id', erroId).maybeSingle()
    if (r) await sb.from('prova_questoes').update(alvo).eq('id', r.questao_id)
  }
  revalidatePath('/caderno-de-erros'); revalidatePath('/desempenho')
  return { ok: true }
}

/** Desiste da tentativa em andamento (ou entregue sem gabarito). Uma prova já corrigida não se desfaz por aqui (exclua em Simulados). */
export async function descartarTentativa(fd: FormData) {
  const { sb } = await ctx()
  const id = String(fd.get('tentativa'))
  if (ehUuid(id)) await sb.from('prova_tentativas').delete().eq('id', id).neq('status', 'corrigida')
  refresh()
  redirect(com('/provas', 'ok', 'Tentativa descartada.'))
}

/** Apaga a prova, as tentativas e as figuras. O que já foi para Simulados, Desempenho e o caderno de erros continua lá. */
export async function excluirProva(fd: FormData) {
  const { sb } = await ctx()
  const id = String(fd.get('prova'))
  if (!ehUuid(id)) redirect('/provas')
  const { data: qs } = await sb.from('prova_questoes').select('blocos').eq('prova_id', id)
  // só as figuras desta prova (numa lista do banco, as figuras são do banco e continuam lá)
  const { data: { user } } = await sb.auth.getUser()
  const figuras = caminhosDasFiguras(qs ?? []).filter(c => c.startsWith(`${user?.id}/${id}/`))
  const { error } = await sb.from('provas').delete().eq('id', id)
  if (error) redirect(com(`/provas/${id}`, 'erro', 'Não foi possível excluir a prova.'))
  if (figuras.length) await sb.storage.from(BUCKET).remove(figuras)
  refresh()
  redirect(com('/provas', 'ok', 'Prova excluída. Os resultados em Simulados e o caderno de erros continuam.'))
}
