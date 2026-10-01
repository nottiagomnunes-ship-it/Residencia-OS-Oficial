import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { NovasConquistas } from '@/components/NovasConquistas'
import { Sidebar, BottomNav } from '@/components/Nav'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: p } = await sb.from('profiles').select('onboarded').eq('id', user.id).single()
  if (!p?.onboarded) redirect('/onboarding')
  const { data: nv } = await sb.from('achievements').select('codigo').eq('visto', false)
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <main className="min-w-0 flex-1 p-4 pb-24 md:p-8"><NovasConquistas codigos={(nv ?? []).map(x => x.codigo)} />{children}</main>
      <BottomNav />
    </div>
  )
}
