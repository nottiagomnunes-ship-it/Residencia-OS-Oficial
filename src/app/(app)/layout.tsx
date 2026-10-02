import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase/server'
import { NovasConquistas } from '@/components/NovasConquistas'
import { NovasPromocoes } from '@/components/NovasPromocoes'
import { contarAssuntos } from '@/lib/gamificacao-data'
import { levelFor } from '@/lib/engine/review'
import { promocoes, passoDoRank } from '@/lib/engine/rank'
import { Sidebar, BottomNav } from '@/components/Nav'
import CronometroProvider from '@/components/CronometroProvider'
import { carregarCronometro } from '@/lib/cronometro-data'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await sb.from('profiles').select('onboarded').eq('id', user.id).single()
  if (!p?.onboarded) redirect('/onboarding')
  const { data: nv } = await sb.from('achievements').select('codigo').eq('visto', false)
  const [{ data: gp }, assuntos] = await Promise.all([sb.from('profiles').select('xp,rank_visto,nivel_visto').single(), contarAssuntos(sb)])
  const cron = await carregarCronometro(sb)
  const menuRecolhido = (await cookies()).get('menu')?.value === 'recolhido' // escolha deste aparelho: menu lateral recolhido
  const promo = gp ? promocoes({ passo: passoDoRank(assuntos.concluidos, assuntos.total), rankVisto: gp.rank_visto ?? 0, nivel: levelFor(gp.xp ?? 0), nivelVisto: gp.nivel_visto ?? 1 }) : { rank: null, titulo: null }
  return (
    <CronometroProvider disponivel={cron.disponivel} ativo={cron.ativo} agora={Date.now()}>
    <div className="flex min-h-dvh">
      <Sidebar recolhidoInicial={menuRecolhido} />
      <main className="min-w-0 flex-1 p-4 pb-28 md:p-8 md:pb-28 lg:pb-8"><NovasPromocoes rank={promo.rank} titulo={promo.titulo} /><NovasConquistas codigos={(nv ?? []).map(x => x.codigo)} />{children}</main>
      <BottomNav />
    </div>
    </CronometroProvider>
  )
}
