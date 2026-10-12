import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { ordenarRanking, semanaDe, type LinhaRanking } from '@/lib/engine/grupos'
import { Bar } from '@/components/ui'

/** Em Hoje: a posição da semana no grupo (ou um convite discreto para criar um). Sem a migração dos grupos, não mostra nada. */
export default async function GrupoNoHoje({ hoje }: { hoje: string }) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  const { data: meus, error } = await sb.from('grupo_membros').select('grupo_id,grupos(nome)').eq('user_id', user?.id ?? '').order('entrou_em').limit(10)
  if (error) return null
  if (!meus?.length) return (
    <p className="text-sm text-muted">Quer estudar junto com a turma? <Link href="/grupos" className="text-brand underline">Crie um grupo</Link> e veja quem cumpriu mais do plano na semana.</p>)
  const g = meus[0] as unknown as { grupo_id: string; grupos: { nome: string } | null }
  const { data } = await sb.rpc('ranking_do_grupo', { p_grupo: g.grupo_id, p_ini: semanaDe(hoje).ini, p_hoje: hoje })
  const r = ordenarRanking((data ?? []) as LinhaRanking[]), eu = r.find(x => x.eu)
  if (!eu) return null
  const outros = meus.length > 1 ? ` · +${meus.length - 1} ${meus.length === 2 ? 'grupo' : 'grupos'}` : ''
  return (
    <Link href={`/grupos?g=${g.grupo_id}`} className="block space-y-2 rounded-2xl border border-line bg-surface p-5 hover:border-brand">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="text-sm text-muted">{g.grupos?.nome ?? 'Seu grupo'} · semana{outros}</h2>
        <span className="text-sm text-brand">Ver ranking ›</span>
      </div>
      {eu.posicao
        ? <p className="text-lg font-semibold">Você está em {eu.posicao}º de {r.length} <span className="text-sm font-normal text-muted">· {eu.pct}% do plano</span></p>
        : <p className="text-lg font-semibold">Sem plano nesta semana <span className="text-sm font-normal text-muted">· {r.length} {r.length === 1 ? 'pessoa' : 'pessoas'} no grupo</span></p>}
      {eu.pct !== null && <Bar pct={eu.pct} />}
    </Link>)
}
