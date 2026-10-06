import { supabaseServer } from '@/lib/supabase/server'
import { aplicarFiltros, assuntoDoFiltro, aplicarFiltroAdmin, lerFiltroAdmin, hashesReportados, ehAdmin } from '@/lib/banco-data'
import { lerFiltros, pacoteDoBanco } from '@/lib/engine/banco'
import type { Alternativa, Bloco } from '@/lib/engine/provas'
import { hojeBR } from '@/lib/dates'
import { todasAsLinhas, emBlocos } from '@/lib/paginar'

/**
 * Exporta as questões dos filtros como pacote .json (formato do importador), para classificar fora do app (ex.: mandar ao Claude) e importar de
 * volta: as que já estão no banco não se repetem, só recebem o tema. Só quem organiza o banco.
 */
export async function GET(req: Request) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return new Response('Entre na sua conta.', { status: 401 })
  if (!(await ehAdmin(sb))) return new Response('Só a conta administradora exporta o banco.', { status: 403 })
  const ps = Object.fromEntries(new URL(req.url).searchParams), f = lerFiltros(ps), adm = lerFiltroAdmin(ps.adm) // adm: filtro da Administração (ex.: sem tema)
  const [topico, reportados] = await Promise.all([assuntoDoFiltro(sb, f), adm === 'reportadas' ? hashesReportados(sb) : Promise.resolve([])])
  const { data, error } = await todasAsLinhas((de, ate) => aplicarFiltroAdmin(aplicarFiltros(sb.from('banco_questoes').select('id,blocos,alternativas,gabarito,gabarito_origem,anulada,comentario,area,discipline_id,assunto,banca,ano'), f, topico), adm, reportados)
    .order('criada_em').order('id').range(de, ate), 20000)
  if (error) return new Response('Não foi possível ler o banco.', { status: 500 })
  const qs = (data ?? []) as any[]
  const [{ data: ds }, { data: comTema }, { data: comExpl }] = await Promise.all([
    sb.from('disciplines').select('id,nome'),
    emBlocos(qs.map(q => q.id), ids => sb.from('banco_questoes').select('id,temas(especialidade,nome)').in('id', ids).not('tema_id', 'is', null)), // sem a 0040: nada
    emBlocos(qs.map(q => q.id), ids => sb.from('banco_questoes').select('id,explicacao,explicacao_origem').in('id', ids).not('explicacao', 'is', null)), // sem a 0042: nada
  ])
  const disc = new Map((ds ?? []).map(d => [d.id as string, d.nome as string]))
  const tema = new Map(((comTema ?? []) as any[]).filter(q => q.temas).map(q => [q.id as string, `${q.temas.especialidade} > ${q.temas.nome}`]))
  const ex = new Map(((comExpl ?? []) as any[]).map(q => [q.id as string, q]))
  const pacote = pacoteDoBanco(qs.map(q => ({
    blocos: (q.blocos ?? []) as Bloco[], alternativas: (q.alternativas ?? []) as Alternativa[], gabarito: q.gabarito, gabarito_origem: q.gabarito_origem, anulada: q.anulada,
    comentario: q.comentario, area: q.area, disciplina: q.discipline_id ? disc.get(q.discipline_id) ?? null : null, assunto: q.assunto, tema: tema.get(q.id) ?? null, banca: q.banca, ano: q.ano,
    explicacao: ex.get(q.id)?.explicacao ?? null, explicacao_origem: ex.get(q.id)?.explicacao_origem ?? null,
  })), `Exportado do banco em ${hojeBR()}`)
  return new Response(JSON.stringify(pacote, null, 1), { headers: {
    'content-type': 'application/json; charset=utf-8', 'content-disposition': `attachment; filename="banco-${hojeBR()}-${qs.length}-questoes.json"`, 'cache-control': 'no-store',
  } })
}
