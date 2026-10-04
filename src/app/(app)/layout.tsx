import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { supabaseServer } from '@/lib/supabase/server'
import { NovasConquistas } from '@/components/NovasConquistas'
import { NovasPromocoes } from '@/components/NovasPromocoes'
import { contarAssuntos } from '@/lib/gamificacao-data'
import { levelFor } from '@/lib/engine/review'
import { promocoes, passoDoRank } from '@/lib/engine/rank'
import { Sidebar, BottomNav, SubNav } from '@/components/Nav'
import CronometroProvider from '@/components/CronometroProvider'
import { AvisosProvider } from '@/components/Avisos'
import { carregarCronometro } from '@/lib/cronometro-data'
import Tutorial from '@/components/Tutorial'
import { ehAdmin } from '@/lib/banco-data'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  // tudo ao mesmo tempo (antes eram 6 idas ao banco em fila, em todas as páginas). O tutorial fica em consulta à parte: sem a 0031, dá erro e não aparece.
  const [{ data: p }, { data: nv }, { data: gp }, assuntos, cron, { data: tut, error: semTutorial }, jar, admin] = await Promise.all([
    sb.from('profiles').select('onboarded').eq('id', user.id).single(),
    sb.from('achievements').select('codigo').eq('visto', false),
    sb.from('profiles').select('xp,rank_visto,nivel_visto').single(),
    contarAssuntos(sb), carregarCronometro(sb),
    sb.from('profiles').select('tutorial_visto_em').eq('id', user.id).single(),
    cookies(), ehAdmin(sb),
  ])
  if (!p?.onboarded) redirect('/onboarding')
  const primeiraVez = !semTutorial && !!tut && !tut.tutorial_visto_em
  const menuRecolhido = jar.get('menu')?.value === 'recolhido' // escolha deste aparelho: menu lateral recolhido
  const promo = gp ? promocoes({ passo: passoDoRank(assuntos.concluidos, assuntos.total), rankVisto: gp.rank_visto ?? 0, nivel: levelFor(gp.xp ?? 0), nivelVisto: gp.nivel_visto ?? 1 }) : { rank: null, titulo: null }
  return (
    <AvisosProvider>
    <CronometroProvider disponivel={cron.disponivel} ativo={cron.ativo} agora={Date.now()}>
    <div className="flex min-h-dvh">
      <Sidebar recolhidoInicial={menuRecolhido} admin={admin} />
      <main className="min-w-0 flex-1 p-4 pb-28 md:p-8 md:pb-28 lg:pb-8"><NovasPromocoes rank={promo.rank} titulo={promo.titulo} /><NovasConquistas codigos={(nv ?? []).map(x => x.codigo)} /><SubNav admin={admin} />{children}</main>
      <BottomNav />
    </div>
    <Tutorial primeiraVez={primeiraVez} />
    </CronometroProvider>
    </AvisosProvider>
  )
}
