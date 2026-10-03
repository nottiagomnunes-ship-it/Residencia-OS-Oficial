import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { gerarCronogramaAction } from '@/lib/schedule'
import { apagarCompromissosAntigos } from '@/lib/capacidade'
import { hojeBR } from '@/lib/dates'
import { addDays } from '@/lib/engine/review'
import { weekStart } from '@/lib/engine/calendar'
import { capacidadeDoDia, diasDaSemana, formatarMinutos, planoDesatualizado } from '@/lib/engine/tempo'
import CapacidadeSemana from '@/components/CapacidadeSemana'

export default async function Semana() {
  const sb = await supabaseServer(), hoje = hojeBR(), seg = weekStart(hoje), prox = addDays(seg, 7)
  const [{ data: p }, { data: caps }, { count: antigos }, { data: pp }] = await Promise.all([
    sb.from('profiles').select('daily_minutes,available_weekdays').single(),
    sb.from('capacidade_dia').select('data,minutos').gte('data', seg).lte('data', addDays(prox, 6)),
    sb.from('commitments').select('id', { count: 'exact', head: true }).eq('agenda', false),
    sb.from('profiles').select('plano_gerado_em,capacidade_alterada_em').single(),
  ])
  const informados = Object.fromEntries((caps ?? []).map(c => [c.data as string, c.minutos as number]))
  const padrao = p?.daily_minutes ?? 120, disponiveis = p?.available_weekdays ?? [1, 2, 3, 4, 5]
  const semana = (segunda: string) => {
    const dias = diasDaSemana(segunda).filter(d => d >= hoje)
    return {
      dias, informados: Object.fromEntries(dias.filter(d => informados[d] !== undefined).map(d => [d, informados[d]])),
      padroes: Object.fromEntries(dias.map(d => [d, capacidadeDoDia(d, {}, padrao, disponiveis).minutos])),
    }
  }
  const a = semana(seg), b = semana(prox)
  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Minha semana</h1><p className="text-muted">Diga quanto tempo você tem para estudar em cada dia. Sem horários: o app só monta o que cabe.</p></div>
        <form action={gerarCronogramaAction}><button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Atualizar meu cronograma</button></form>
      </div>
      <p className="text-sm text-muted">Escala mudou? É só tocar no tempo de cada dia. Os dias que você não preencher usam o seu tempo padrão ({formatarMinutos(padrao)} nos dias disponíveis). Para mudar o padrão, vá em <Link href="/configuracoes" className="text-brand underline">Configurações</Link>. Depois de mexer, toque em <b>Atualizar meu cronograma</b>.</p>
      {planoDesatualizado(pp?.capacidade_alterada_em, pp?.plano_gerado_em) && <p role="status" className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">Você mudou o tempo desde a última atualização. Toque em <b>Atualizar meu cronograma</b> para o plano acompanhar.</p>}
      {a.dias.length > 0 && <CapacidadeSemana titulo="Esta semana" segunda={seg} {...a} />}
      <CapacidadeSemana titulo="Próxima semana" segunda={prox} {...b} />
      {!!antigos && (
        <section className="space-y-2 rounded-2xl border border-line bg-surface p-5 text-sm">
          <h2 className="font-medium">Horários do modelo antigo</h2>
          <p className="text-muted">Você tem {antigos} {antigos === 1 ? 'horário cadastrado' : 'horários cadastrados'} do modelo antigo de Minha semana. Eles não entram no estudo, mas podem ir para a <Link href="/agenda" className="text-brand underline">Agenda pessoal</Link>.</p>
          <form action={apagarCompromissosAntigos}><button className="rounded-xl border border-line px-4 py-2 hover:border-danger hover:text-danger">Apagar horários antigos</button></form>
        </section>)}
    </div>
  )
}
