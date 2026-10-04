import type { SupabaseClient } from '@supabase/supabase-js'
import { SEM_ASSUNTO, type Filtros } from './engine/banco'
import { ehLetra, type Alternativa, type Bloco } from './engine/provas'
import { BUCKET } from './provas-data'
import type { Tema } from './engine/temas'

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
  if (f.tema) x = x.eq('tema_id', f.tema)
  if (f.banca) x = x.eq('banca', f.banca)
  if (f.anoDe) x = x.gte('ano', f.anoDe)
  if (f.anoAte) x = x.lte('ano', f.anoAte)
  if (f.questao) x = x.eq('id', f.questao)
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

/**
 * Traz o banco geral para a conta (questões novas e correções do administrador). Rápido quando não há nada novo.
 * Sem a 0037 (ou sem internet com o banco), devolve null e a página segue normal.
 */
export async function sincronizarBancoGeral(sb: SupabaseClient): Promise<{ novas: number; corrigidas: number } | null> {
  const { data, error } = await sb.rpc('sincronizar_banco_geral')
  if (error || !data) return null
  return { novas: Number(data.novas) || 0, corrigidas: Number(data.corrigidas) || 0 }
}

/** A conta é a administradora do banco geral? (false sem a 0037) */
export async function ehAdmin(sb: SupabaseClient) {
  const { data, error } = await sb.rpc('eh_admin')
  return !error && data === true
}

/** Frase para o aviso depois de sincronizar ("12 questões novas do banco geral entraram no seu banco."), ou null se nada mudou. */
export function avisoDoBancoGeral(s: { novas: number; corrigidas: number } | null) {
  if (!s || (!s.novas && !s.corrigidas)) return null
  const partes = [
    s.novas ? `${s.novas} ${s.novas === 1 ? 'questão nova do banco geral entrou' : 'questões novas do banco geral entraram'} no seu banco` : null,
    s.corrigidas ? `${s.corrigidas} ${s.corrigidas === 1 ? 'questão foi corrigida' : 'questões foram corrigidas'} (gabarito ou enunciado)` : null,
  ].filter(Boolean)
  return partes.join(' e ') + '.'
}

/**
 * Pode importar e organizar o banco (assuntos, lote, banco geral)? Só a conta administradora; o estudante só busca e pratica.
 * Sem o sistema de administração (antes da 0037), qualquer conta pode, como era antes.
 */
export const SO_ADMIN = 'Só a conta administradora importa e organiza o banco de questões.'

/**
 * A fila de "refazer as erradas": quantas questões estão para refazer hoje (incluindo as atrasadas), quantas atrasadas e quantas vêm
 * nos próximos 7 dias. null sem a 0039.
 */
export async function carregarFilaRefazer(sb: SupabaseClient, hoje: string, em7dias: string) {
  const base = () => sb.from('revisao_questoes').select('questao_id', { count: 'exact', head: true }).not('proxima', 'is', null)
  const [a, b, c] = await Promise.all([base().lte('proxima', hoje), base().lt('proxima', hoje), base().gt('proxima', hoje).lte('proxima', em7dias)])
  if (a.error) return null
  return { hoje: a.count ?? 0, atrasadas: b.count ?? 0, semana: c.count ?? 0 }
}

/** A lista geral de temas (vazia sem a 0040). */
export async function carregarTemas(sb: SupabaseClient): Promise<Tema[]> {
  const { data, error } = await sb.from('temas').select('id,area,especialidade,nome,palavras').limit(5000)
  if (!error) return (data ?? []) as Tema[]
  const { data: d2, error: e2 } = await sb.from('temas').select('id,area,especialidade,nome').limit(5000) // sem a 0041 (sem palavras-chave)
  return e2 ? [] : ((d2 ?? []) as Tema[])
}

/** Filtros só da Administração (o que falta fazer nas questões). */
export const FILTROS_ADMIN = [
  ['reportadas', 'Com explicação reportada'], ['sem-tema', 'Sem tema'], ['sem-explicacao', 'Sem explicação'],
  ['falta-publicar', 'Alteradas, falta publicar'], ['so-meu', 'Só no seu banco (não publicadas)'], ['publicadas', 'Publicadas no banco geral'],
] as const
export type FiltroAdmin = (typeof FILTROS_ADMIN)[number][0]
export const lerFiltroAdmin = (v: string | null | undefined): FiltroAdmin | null => (FILTROS_ADMIN.find(([k]) => k === v)?.[0] ?? null)

/** Aplica o filtro da Administração. "reportadas" precisa das impressões digitais das questões com reporte aberto. */
export function aplicarFiltroAdmin<Q>(q: Q, adm: FiltroAdmin | null, hashesReportados: string[] = []): Q {
  let x = q as any
  if (adm === 'sem-tema') x = x.is('tema_id', null)
  if (adm === 'sem-explicacao') x = x.is('explicacao', null).eq('anulada', false).not('gabarito', 'is', null)
  if (adm === 'falta-publicar') x = x.eq('pendente_publicar', true)
  if (adm === 'so-meu') x = x.is('origem_geral', null)
  if (adm === 'publicadas') x = x.not('origem_geral', 'is', null)
  if (adm === 'reportadas') x = x.in('hash', hashesReportados.length ? hashesReportados : ['-'])
  return x as Q
}

/** As impressões digitais das questões com explicação reportada e ainda não resolvida (sem a 0042: nenhuma). */
export async function hashesReportados(sb: SupabaseClient) {
  const { data } = await sb.from('explicacao_reportes').select('hash').is('resolvido_em', null).limit(2000)
  return [...new Set(((data ?? []) as { hash: string }[]).map(r => r.hash))]
}
