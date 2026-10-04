'use server'
import { revalidatePath } from 'next/cache'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { lerFiltros, escolherProxima } from '@/lib/engine/banco'
import { ehLetra, ehUuid, textoParaCaderno, type Alternativa, type Bloco } from '@/lib/engine/provas'
import { aplicarFiltros, assuntoDoFiltro, carregarQuestaoPratica, type QuestaoPratica } from '@/lib/banco-data'
import { carregarGamificacao } from '@/lib/gamificacao-data'

const sessao = async () => {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  return user ? sb : null
}

/** A próxima questão do Praticar pelos filtros, sem repetir as já vistas nesta sessão. `restantes` = quantas ainda faltam (incluindo esta). */
export async function proximaQuestao(filtrosBrutos: Record<string, string | undefined>, vistos: string[]): Promise<{ questao: QuestaoPratica | null; restantes: number; erro?: string }> {
  const sb = await sessao()
  if (!sb) return { questao: null, restantes: 0, erro: 'Sua sessão expirou. Entre de novo.' }
  const f = lerFiltros(filtrosBrutos), topico = await assuntoDoFiltro(sb, f)
  const ja = vistos.filter(ehUuid).slice(-300)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let q: any = aplicarFiltros(sb.from('banco_questoes').select('id,vezes,ultimo_certo,ultima_em').eq('anulada', false).not('gabarito', 'is', null), f, topico)
  if (ja.length) q = q.not('id', 'in', `(${ja.join(',')})`)
  if (f.revisao) { // "Refazer as erradas": só as que estão para refazer hoje (ou atrasadas)
    const { data: fila, error: e } = await sb.from('revisao_questoes').select('questao_id').not('proxima', 'is', null).lte('proxima', hojeBR()).limit(1000)
    if (e) return { questao: null, restantes: 0, erro: 'Falta atualizar o banco: rode supabase/migrations/0039_refazer_erradas.sql no SQL Editor do Supabase.' }
    const ids = (fila ?? []).map((r: { questao_id: string }) => r.questao_id)
    if (!ids.length) return { questao: null, restantes: 0 }
    q = q.in('id', ids)
  }
  const { data, error } = (await q.limit(2000)) as { data: { id: string; vezes: number; ultimo_certo: boolean | null; ultima_em: string | null }[] | null; error: unknown }
  if (error) return { questao: null, restantes: 0, erro: 'Não foi possível buscar a próxima questão. Confira a internet.' }
  const escolhida = escolherProxima(data ?? [])
  if (!escolhida) return { questao: null, restantes: 0 }
  return { questao: await carregarQuestaoPratica(sb, escolhida.id), restantes: (data ?? []).length }
}

/** Onde a questão ficou na fila de refazer depois desta resposta (só quando mudou): etapa 0 = amanhã, 1 = em 7 dias, 2 = em 30, 3 = saiu. */
export type Refazer = { etapa: number; proxima: string | null }
export type Correcao = { correta: boolean; gabarito: string; gabaritoIA: boolean; comentario: string | null; erroId: string | null; xp: number; refazer?: Refazer | null }
/** Corrige na hora e grava (sessão de questões do dia, XP, contagem da questão e, se errou ou chutou, o Caderno de Erros). */
export async function responderPratica(id: string, alternativa: string, chute: boolean): Promise<{ ok: true; correcao: Correcao } | { ok: false; erro: string }> {
  const sb = await sessao()
  if (!sb) return { ok: false, erro: 'Sua sessão expirou. Entre de novo.' }
  if (!ehUuid(id) || !ehLetra(alternativa)) return { ok: false, erro: 'Resposta inválida.' }
  const { data: q } = await sb.from('banco_questoes').select('blocos,alternativas,gabarito,banca,ano').eq('id', id).maybeSingle()
  if (!q) return { ok: false, erro: 'Questão não encontrada.' }
  const origem = [q.banca, q.ano].filter(Boolean).join(' ') || 'Banco de questões'
  const texto = textoParaCaderno(origem, { numero: 0, blocos: (q.blocos ?? []) as Bloco[], alternativas: (q.alternativas ?? []) as Alternativa[] }, alternativa, ehLetra(q.gabarito) ? q.gabarito : null)
    .replace(/ · Questão 0\n/, '\n')
  const filaDaQuestao = async () => { const { data: r } = await sb.from('revisao_questoes').select('etapa,proxima,atualizada_em').eq('questao_id', id).maybeSingle(); return r as (Refazer & { atualizada_em: string }) | null }
  const antes = await filaDaQuestao().catch(() => null)
  const { data, error } = await sb.rpc('responder_pratica', { p_questao: id, p_alt: alternativa, p_chute: chute, p_dia: hojeBR(), p_texto: texto })
  if (error || !data) return { ok: false, erro: /responder_pratica/.test(error?.message ?? '') ? 'Falta atualizar o banco: rode supabase/migrations/0035_praticar.sql no SQL Editor do Supabase.' : 'Não foi possível gravar a resposta. Tente de novo.' }
  const d0 = data as Record<string, unknown>
  if (chute && d0.correta === true) await sb.rpc('refazer_chutes', { p_ids: [id] }) // acertou no chute: refazer também (sem a 0039, nada acontece)
  const depois = await filaDaQuestao().catch(() => null)
  const refazer = depois && depois.atualizada_em !== antes?.atualizada_em ? { etapa: depois.etapa, proxima: depois.proxima } : null
  await carregarGamificacao(sb, hojeBR()).catch(() => {})
  ;['/banco', '/revisoes', '/questoes', '/desempenho', '/caderno-de-erros', '/inicio'].forEach(p => revalidatePath(p))
  const d = data as Record<string, unknown>
  return { ok: true, correcao: { correta: d.correta === true, gabarito: String(d.gabarito), gabaritoIA: d.gabarito_origem === 'ia', comentario: (d.comentario as string) ?? null, erroId: (d.erro_id as string) ?? null, xp: Number(d.xp ?? 0), refazer } }
}
