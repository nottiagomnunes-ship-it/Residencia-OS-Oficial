import { supabaseServer } from '@/lib/supabase/server'
import { criarCompromisso, excluirCompromisso, salvarJanela } from '@/lib/compromissos'
import { gerarCronogramaAction } from '@/lib/schedule'
import { hojeBR } from '@/lib/dates'
import { addDays } from '@/lib/engine/review'
import { weekStart } from '@/lib/engine/calendar'
import { hhmmParaMin, janelasDoDia, minParaHhmm, ocupadosPorData, paraCompromisso } from '@/lib/engine/compromissos'
import { fmtData, inputCls } from '@/components/ui'

const DIAS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']
const fmtMin = (m: number) => `${Math.floor(m / 60)}h${m % 60 ? String(m % 60).padStart(2, '0') : ''}`

export default async function Semana({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams, hoje = hojeBR()
  const sb = await supabaseServer()
  const [{ data: p }, { data: cm }] = await Promise.all([
    sb.from('profiles').select('janela_ini,janela_fim,folga_min').single(), sb.from('commitments').select('*').order('created_at'),
  ])
  const comps = (cm ?? []).map(paraCompromisso)
  const ini = weekStart(hoje), dias = Array.from({ length: 7 }, (_, i) => addDays(ini, i))
  const oc = ocupadosPorData(comps, addDays(ini, -1), addDays(ini, 6))
  const wi = hhmmParaMin(p?.janela_ini ?? '06:00'), wf = hhmmParaMin(p?.janela_fim ?? '23:00'), folga = p?.folga_min ?? 30
  const cards = dias.map(d => {
    const o = [...(oc[d] ?? [])].sort((a, b) => a.ini - b.ini), j = janelasDoDia(wi, wf, o, folga)
    return { d, o, j, livre: j.reduce((s, [x, y]) => s + (y - x), 0) }
  })
  const sec = 'space-y-4 rounded-2xl border border-line bg-surface p-5'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h1 className="text-2xl font-semibold">Minha semana</h1><p className="text-muted">Cadastre seus horários ocupados; o cronograma de estudos usa só o tempo livre.</p></div>
        <form action={gerarCronogramaAction}><button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Gerar cronograma com estes horários</button></form>
      </div>
      {ok && <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm">Salvo. Para aplicar ao plano, gere o cronograma de novo.</p>}
      {erro && <p role="alert" className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{erro}</p>}

      <section className="space-y-3"><h2 className="font-medium">Esta semana <span className="text-sm font-normal text-muted">({fmtData(dias[0])} a {fmtData(dias[6])})</span></h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{cards.map(c => (
          <div key={c.d} className={`space-y-2 rounded-2xl border bg-surface p-4 text-sm ${c.d === hoje ? 'border-brand' : 'border-line'}`}>
            <p className="font-medium">{DIAS[new Date(c.d + 'T12:00:00Z').getUTCDay()]} <span className="text-muted">{fmtData(c.d)}</span></p>
            {c.o.map((x, i) => <p key={i} className="rounded-lg bg-line/60 px-2 py-1 text-muted">{minParaHhmm(x.ini)}–{x.fim >= 1440 ? '24:00' : minParaHhmm(x.fim)} {x.titulo}</p>)}
            <p className={c.livre ? 'text-brand' : 'text-danger'}>{c.livre ? `Livre: ${fmtMin(c.livre)} (${c.j.map(([x, y]) => `${minParaHhmm(x)}–${minParaHhmm(y)}`).join(', ')})` : 'Sem janela livre'}</p>
          </div>))}</div></section>

      <form action={criarCompromisso} className={sec}>
        <h2 className="font-medium">Adicionar compromisso</h2>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <input name="titulo" required placeholder="Ex.: Internato, Plantão, Aula" className={inputCls + ' xl:col-span-2'} />
          <label className="space-y-1 text-sm"><span className="block text-muted">Início</span><input name="hora_ini" type="time" required className={inputCls + ' w-full'} /></label>
          <label className="space-y-1 text-sm"><span className="block text-muted">Fim</span><input name="hora_fim" type="time" required className={inputCls + ' w-full'} /></label>
        </div>
        <fieldset><legend className="mb-2 text-sm">Dias da semana (repete toda semana)</legend><div className="flex flex-wrap gap-2">{[1, 2, 3, 4, 5, 6, 0].map(i => (
          <label key={i} className="cursor-pointer rounded-lg border border-line px-3 py-1.5 text-sm has-[:checked]:border-brand has-[:checked]:text-brand"><input type="checkbox" name="dias" value={i} className="sr-only" />{DIAS[i]}</label>))}</div></fieldset>
        <details className="text-sm"><summary className="cursor-pointer text-brand">Só um dia, ou com prazo de validade</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-3">
            <label className="space-y-1"><span className="block text-muted">Data única (em vez dos dias acima)</span><input name="data" type="date" className={inputCls + ' w-full'} /></label>
            <label className="space-y-1"><span className="block text-muted">Vale a partir de</span><input name="valido_de" type="date" className={inputCls + ' w-full'} /></label>
            <label className="space-y-1"><span className="block text-muted">Vale até</span><input name="valido_ate" type="date" className={inputCls + ' w-full'} /></label>
          </div></details>
        <p className="text-xs text-muted">Se o fim for menor que o início, o horário vira a noite (plantão de 19:00 às 07:00 ocupa a noite e a manhã seguinte).</p>
        <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Adicionar</button>
      </form>

      {comps.length > 0 && <section className={sec}><h2 className="font-medium">Meus compromissos</h2>
        <ul className="space-y-2">{(cm ?? []).map((r: any) => { const c = paraCompromisso(r); return (
          <li key={r.id} className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <span><b>{c.titulo}</b> · {c.tipo === 'pontual' ? fmtData(c.data) : [...c.dias].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(d => DIAS[d]).join(', ')} · {minParaHhmm(c.ini)}–{minParaHhmm(c.fim)}{c.fim <= c.ini ? ' (vira a noite)' : ''}
              {(c.valido_de || c.valido_ate) && <span className="text-muted"> · {c.valido_de ? `de ${fmtData(c.valido_de)} ` : ''}{c.valido_ate ? `até ${fmtData(c.valido_ate)}` : ''}</span>}</span>
            <form action={excluirCompromisso}><input type="hidden" name="id" value={r.id} /><button className="text-danger hover:underline">Excluir</button></form>
          </li>) })}</ul></section>}

      <form action={salvarJanela} className={sec}>
        <h2 className="font-medium">Em que horários posso estudar?</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1 text-sm"><span className="block text-muted">Começo do dia</span><input name="janela_ini" type="time" defaultValue={(p?.janela_ini ?? '06:00').slice(0, 5)} className={inputCls + ' w-full'} /></label>
          <label className="space-y-1 text-sm"><span className="block text-muted">Fim do dia</span><input name="janela_fim" type="time" defaultValue={(p?.janela_fim ?? '23:00').slice(0, 5)} className={inputCls + ' w-full'} /></label>
          <label className="space-y-1 text-sm"><span className="block text-muted">Folga antes e depois (min)</span><input name="folga_min" type="number" min={0} max={180} step={5} defaultValue={folga} className={inputCls + ' w-full'} /></label>
        </div>
        <p className="text-xs text-muted">A folga reserva tempo de deslocamento e descanso ao redor de cada compromisso.</p>
        <button className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Salvar janela</button>
      </form>
    </div>
  )
}
