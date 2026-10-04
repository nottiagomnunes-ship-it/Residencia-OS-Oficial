import type { SupabaseClient } from '@supabase/supabase-js'
import { lerArea, type Area } from './engine/areas'
import { ehLetra, type Alternativa, type Bloco, type Letra } from './engine/provas'

export const BUCKET = 'provas'
/** Validade dos links das figuras: uma prova longa cabe folgada (o link é refeito a cada vez que a página abre). */
const VALIDADE_S = 60 * 60 * 12

/** Na tela, a figura chega com o endereço temporário (o arquivo é privado). */
export type BlocoNaTela = { tipo: 'texto'; texto: string } | { tipo: 'imagem'; caminho: string; url: string | null }
export type QuestaoNaTela = {
  id: string; numero: number; blocos: BlocoNaTela[]; alternativas: Alternativa[]; gabarito: Letra | null; anulada: boolean; area: Area | null
  discipline_id: string | null; topic_id: string | null
  comentario?: string | null; gabaritoIA?: boolean // só nas listas do banco de questões
}

const lerBlocos = (v: unknown): Bloco[] => (Array.isArray(v) ? v.filter(b => b && (b.tipo === 'texto' || b.tipo === 'imagem')) : [])
const lerAlternativas = (v: unknown): Alternativa[] => (Array.isArray(v) ? v.filter(a => a && ehLetra(a.letra)).map(a => ({ letra: a.letra, texto: String(a.texto ?? '') })) : [])

/** Todas as figuras da prova, para apagar do armazenamento junto com ela. */
export const caminhosDasFiguras = (questoes: { blocos: unknown }[]) =>
  questoes.flatMap(q => lerBlocos(q.blocos)).flatMap(b => (b.tipo === 'imagem' ? [b.caminho] : []))

/** A prova e as questões em ordem, com os links das figuras. `null` se a prova não existe (ou é de outra pessoa). */
export async function carregarProva(sb: SupabaseClient, provaId: string, comFiguras = true) {
  const [{ data: prova }, { data: qs }, { data: tp }] = await Promise.all([
    sb.from('provas').select('id,nome,banca,ano,criada_em').eq('id', provaId).maybeSingle(),
    sb.from('prova_questoes').select('id,numero,blocos,alternativas,gabarito,anulada,area,discipline_id,topic_id').eq('prova_id', provaId).order('numero'),
    sb.from('provas').select('tipo').eq('id', provaId).maybeSingle(), // lista do banco de questões? (consulta à parte: sem a 0034, tudo segue como prova)
  ])
  if (!prova) return null
  const tipo: 'prova' | 'lista' = tp?.tipo === 'lista' ? 'lista' : 'prova'
  const extras = new Map<string, { comentario: string | null; gabarito_origem: string | null }>()
  if (tipo === 'lista') {
    const { data: lig } = await sb.from('prova_questoes').select('id,banco_questoes(comentario,gabarito_origem)').eq('prova_id', provaId)
    for (const l of (lig ?? []) as unknown as { id: string; banco_questoes: { comentario: string | null; gabarito_origem: string | null } | null }[]) if (l.banco_questoes) extras.set(l.id, l.banco_questoes)
  }
  const caminhos = comFiguras ? caminhosDasFiguras(qs ?? []) : []
  const urls = new Map<string, string>()
  if (caminhos.length) {
    const { data } = await sb.storage.from(BUCKET).createSignedUrls(caminhos, VALIDADE_S)
    for (const d of data ?? []) if (d.path && d.signedUrl) urls.set(d.path, d.signedUrl)
  }
  const questoes: QuestaoNaTela[] = (qs ?? []).map(q => ({
    id: q.id, numero: q.numero, gabarito: ehLetra(q.gabarito) ? q.gabarito : null, anulada: !!q.anulada, area: lerArea(q.area),
    discipline_id: q.discipline_id ?? null, topic_id: q.topic_id ?? null, alternativas: lerAlternativas(q.alternativas),
    comentario: extras.get(q.id)?.comentario ?? null, gabaritoIA: extras.get(q.id)?.gabarito_origem === 'ia',
    blocos: lerBlocos(q.blocos).map(b => (b.tipo === 'imagem' ? { ...b, url: urls.get(b.caminho) ?? null } : b)),
  }))
  return { prova: { ...(prova as { id: string; nome: string; banca: string | null; ano: number | null; criada_em: string }), tipo }, questoes }
}

export type EstadoResposta = { alternativa: Letra | null; chute: boolean; marcada: boolean; riscadas: string }
export async function carregarRespostas(sb: SupabaseClient, tentativaId: string) {
  const { data } = await sb.from('prova_respostas').select('questao_id,alternativa,chute,marcada,riscadas,correta,erro_id').eq('tentativa_id', tentativaId)
  return data ?? []
}
