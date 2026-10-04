import { supabaseServer } from '@/lib/supabase/server'
import { lerFiltros, filtrosParaUrl, rotuloDosAnos, SEM_ASSUNTO } from '@/lib/engine/banco'
import { ROTULO_AREA } from '@/lib/engine/areas'
import { assuntoDoFiltro } from '@/lib/banco-data'
import { proximaQuestao } from '@/lib/pratica'
import Praticar from '@/components/banco/Praticar'

export default async function PraticarPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const f = lerFiltros(await searchParams)
  const sb = await supabaseServer()
  const filtros = Object.fromEntries(new URLSearchParams(filtrosParaUrl(f)))
  const [primeira, topico, disc, tema] = await Promise.all([
    proximaQuestao(filtros, []), assuntoDoFiltro(sb, f),
    f.disciplina ? sb.from('disciplines').select('nome').eq('id', f.disciplina).maybeSingle().then(r => r.data?.nome as string | undefined) : Promise.resolve(undefined),
    f.tema ? sb.from('temas').select('nome').eq('id', f.tema).maybeSingle().then(r => r.data?.nome as string | undefined) : Promise.resolve(undefined),
  ])
  const titulo = f.questao ? 'refazer esta questão' : f.revisao ? 'refazer as erradas' : [f.area ? ROTULO_AREA[f.area] : null, disc, tema ?? topico?.nome ?? (f.assunto === SEM_ASSUNTO ? 'sem assunto' : f.assunto), f.banca, rotuloDosAnos(f),
    f.situacao === 'nunca' ? 'nunca feitas' : f.situacao === 'errei' ? 'que errei' : f.situacao === 'acertei' ? 'que acertei' : null].filter(Boolean).join(' · ') || 'todas as questões'
  return (
    <>
      {primeira.erro && <p role="alert" className="mb-4 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">{primeira.erro}</p>}
      <Praticar key={filtrosParaUrl(f)} filtros={filtros} titulo={titulo} inicial={primeira.questao} total={primeira.restantes} />
    </>)
}
