import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { gerarCronogramaAction } from '@/lib/schedule'
import { hojeBR } from '@/lib/dates'
import { addDays, diffDays } from '@/lib/engine/review'
import { statusDe } from '@/lib/engine/calendar'
import { hhmmParaMin, minParaHhmm, ocupadosPorData, ordenarDia, paraCompromisso } from '@/lib/engine/compromissos'
import { Bar } from '@/components/ui'
import { RitmoCard } from '@/components/RitmoCard'
import { carregarRitmo, carregarModoRitmo } from '@/lib/ritmo-data'

const COR: Record<string, string> = { concluido: 'border-brand', agendado: 'border-info', proximo: 'border-warn', atrasado: 'border-danger' }
const TIPO: Record<string, string> = { estudo: 'Estudo', revisao: 'Revisão', questoes: 'Questões', flashcards: 'Flashcards', simulado: 'Simulado' }

export default async function Cronograma({ searchParams }: { searchParams: Promise<{ msg?: string }> }) {
  const { msg } = await searchParams
  const sb = await supabaseServer(), hoje = hojeBR()
  const [{ data: p }, { data: ts }, { data: it }, { data: cm }] = await Promise.all([
    sb.from('profiles').select('exam_date,daily_minutes,daily_questions_goal').single(),
    sb.from('topics').select('status'),
    sb.from('schedule_items').select('id,tipo,titulo,data,hora_ini,hora_fim,duracao_min,status').gte('data', hoje).lte('data', addDays(hoje, 6)).order('data').order('ordem_dia', { nullsFirst: false }).order('hora_ini', { nullsFirst: false }),
    sb.from('commitments').select('*'),
  ])
  const total = ts?.length ?? 0, ok = ts?.filter(t => t.status === 'concluido').length ?? 0, pct = total ? Math.round((ok / total) * 100) : 0
  const dias = Array.from({ length: 7 }, (_, i) => addDays(hoje, i))
  const oc: Record<string, never[]> = {}
  const rotulo = (d: string, i: number) => (i === 0 ? 'Hoje' : new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' }).replace('-feira', '')) + ` ${d.slice(8)}/${d.slice(5, 7)}`
  const modoRitmo = await carregarModoRitmo(sb)
  const ritmo = modoRitmo === 'oculto' ? null : await carregarRitmo(sb, hoje)
  const card = (t: string, v: string) => <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{t}</p><p className="mt-1 text-2xl font-semibold">{v}</p></div>
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Meu Cronograma</h1>
        <div className="flex flex-wrap gap-2"><Link href="/semana" className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Minha semana</Link>
          <Link href="/importar" className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Importar cronograma</Link>
          <form action={gerarCronogramaAction}><button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Gerar ou atualizar cronograma</button></form></div>
      </div>
      {msg && <p role="status" className="rounded-xl border border-line bg-surface p-4 text-sm">{msg}</p>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        {card('Prova', p?.exam_date ? `em ${diffDays(hoje, p.exam_date)} dias` : 'sem data')}
        {card('Meta diária', `${((p?.daily_minutes ?? 0) / 60).toFixed(1).replace('.0', '')} h · ${p?.daily_questions_goal ?? 0} questões`)}
        {card('Assuntos concluídos', `${ok}/${total}`)}
        <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">Plano concluído</p><p className="mb-2 mt-1 text-2xl font-semibold">{pct}%</p><Bar pct={pct} /></div>
      </div>
      {ritmo && <RitmoCard r={ritmo} modo={modoRitmo} onde="cronograma" />}
      <div className="space-y-4">
        {dias.map((d, i) => {
          const linhas = ordenarDia(oc[d] ?? [], (it ?? []).filter(x => x.data === d))
          return (
            <section key={d} className="rounded-2xl border border-line bg-surface p-4">
              <h2 className="mb-2 font-medium capitalize">{rotulo(d, i)}</h2>
              {!linhas.length ? <p className="text-sm text-muted">Nada programado.</p> : (
                <ul className="space-y-2">{linhas.map((l, k) => l.tipo === 'ocupado' ? (
                  <li key={'o' + k} className="flex flex-wrap items-baseline gap-x-3 border-l-4 border-line pl-3 text-sm text-muted">
                    <span className="w-24">{minParaHhmm(l.o.ini)}–{l.o.fim >= 1440 ? '24:00' : minParaHhmm(l.o.fim)}</span><span>{l.o.titulo}</span></li>
                ) : (
                  <li key={l.x.id} className={`flex flex-wrap items-baseline gap-x-3 border-l-4 pl-3 text-sm ${COR[statusDe(l.x, hoje)]}`}>
                    <span className="w-24 text-muted">{l.x.hora_ini ? `${l.x.hora_ini.slice(0, 5)}–${l.x.hora_fim?.slice(0, 5)}` : l.x.duracao_min ? `${l.x.duracao_min} min` : ''}</span>
                    <span className="text-muted">{TIPO[l.x.tipo]}</span><span>{l.x.titulo}</span></li>))}</ul>)}
            </section>)
        })}
      </div>
      <p className="text-sm text-muted">Veja o mês inteiro e mude datas no <Link href="/calendario" className="text-brand underline">Calendário</Link>.</p>
    </div>
  )
}
