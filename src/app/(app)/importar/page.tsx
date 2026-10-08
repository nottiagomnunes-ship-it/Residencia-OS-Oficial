import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import Importador from '@/components/Importador'

export default async function Importar({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams
  const { count } = await (await supabaseServer()).from('topics').select('id', { count: 'exact', head: true })
  return (
    <div className="max-w-3xl space-y-6">
      <div><h1 className="text-2xl font-semibold">Importar cronograma</h1>
        <p className="text-muted">Traga o seu próprio plano de estudos em texto ou PDF, ou use o cronograma pronto do R1TMO. Você confere tudo antes de importar.</p></div>
      <Importador hoje={hojeBR()} total={count ?? 0} erro={erro?.slice(0, 300)} />
    </div>
  )
}
