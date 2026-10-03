import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { hojeBR } from '@/lib/dates'
import { addDays } from '@/lib/engine/review'
import { weekStart } from '@/lib/engine/calendar'
import { diasDaSemana } from '@/lib/engine/tempo'
import { minParaHhmm } from '@/lib/engine/compromissos'
import { CATEGORIAS, corDaCategoria, quando, ehCategoria } from '@/lib/engine/agenda'
import { agendaDosDias } from '@/lib/agenda-data'
import { excluirDaAgenda, pararDeRepetir, copiarEscalaAnterior, trazerHorariosAntigos, salvarJanelaDoDia } from '@/lib/agenda'
import AgendaForm from '@/components/AgendaForm'
import BlocoAgenda from '@/components/BlocoAgenda'
import EscalaRapida from '@/components/EscalaRapida'
import CoresAgenda from '@/components/CoresAgenda'
import { carregarCores } from '@/lib/agenda-data'
import AvisoDaUrl from '@/components/AvisoDaUrl'
import { fmtData, inputCls } from '@/components/ui'

export default async function Agenda({ searchParams }: { searchParams: Promise<{ s?: string; ok?: string; erro?: string }> }) {
  const { s, ok, erro } = await searchParams
  const hoje = hojeBR(), seg = /^\d{4}-\d{2}-\d{2}$/.test(s ?? '') ? weekStart(s!) : weekStart(hoje), dias = diasDaSemana(seg)
  const sb = await supabaseServer()
  const [ag, { data: p }, { count: antigos }] = await Promise.all([
    agendaDosDias(sb, dias[0], dias[6]),
    sb.from('profiles').select('janela_ini,janela_fim,folga_min').single(),
    sb.from('commitments').select('id', { count: 'exact', head: true }).eq('agenda', false),
  ])
  const coresDisp = (await carregarCores(sb)).disponivel
  const nomeDia = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' }).replace('-feira', '')
  const hora = (m: number) => (m >= 1440 ? '24:00' : minParaHhmm(m))
  const daSemana = ag.linhas.filter(l => l.tipo === 'pontual' && l.data && l.data >= seg && l.data <= dias[6]).map(l => ({ data: l.data!, hora_ini: l.hora_ini, hora_fim: l.hora_fim, titulo: l.titulo }))
  const pontuaisAnteriores = ag.linhas.some(l => l.tipo === 'pontual' && l.data && l.data >= addDays(seg, -7) && l.data < seg)
  const ordenadas = [...ag.linhas].filter(l => l.tipo === 'semanal' ? !l.valido_ate || l.valido_ate >= hoje : (l.data ?? '') >= addDays(hoje, -1))
    .sort((a, b) => (a.tipo === b.tipo ? 0 : a.tipo === 'semanal' ? -1 : 1) || (a.data ?? '').localeCompare(b.data ?? '') || a.hora_ini.localeCompare(b.hora_ini))
  const btn = 'rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand'
  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold">Agenda pessoal</h1>
        <p className="text-muted">Internato, plantões, academia, aulas e compromissos. Ficam separados do estudo: não viram tarefa, não contam nas horas estudadas e o cronograma não muda por causa deles. Eles aparecem junto no Calendário, com o tempo livre de cada dia.</p>
      </div>
      {ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{ok}</AvisoDaUrl>}
      {erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{erro}</AvisoDaUrl>}
      {!ag.disponivel && <p className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Para usar a agenda, rode <code>supabase/migrations/0029_agenda_pessoal.sql</code> no SQL Editor do Supabase e recarregue a página.</p>}

      {ag.disponivel && <div className="space-y-6 lg:grid lg:grid-cols-[24rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
        <div className="space-y-4 lg:sticky lg:top-6">
          <AgendaForm semana={seg} hoje={hoje} />
          <EscalaRapida semana={seg} cores={ag.cores} existentes={daSemana} />
          <CoresAgenda cores={ag.cores} disponivel={coresDisp} />
          <details className="rounded-2xl border border-line bg-surface p-5">
            <summary className="cursor-pointer font-medium">Horário do seu dia</summary>
            <form action={salvarJanelaDoDia} className="mt-3 space-y-3 text-sm">
              <input type="hidden" name="semana" value={seg} />
              <p className="text-muted">Usado só para calcular o tempo livre: a parte do dia em que você está acordado e disponível, e a folga em volta de cada compromisso (deslocamento, banho...).</p>
              <div className="grid grid-cols-3 gap-2">
                <label className="text-muted">De<input type="time" name="janela_ini" defaultValue={(p?.janela_ini ?? '06:00').slice(0, 5)} className={inputCls + ' mt-1 w-full'} /></label>
                <label className="text-muted">Até<input type="time" name="janela_fim" defaultValue={(p?.janela_fim ?? '23:00').slice(0, 5)} className={inputCls + ' mt-1 w-full'} /></label>
                <label className="text-muted">Folga (min)<input type="number" name="folga_min" min={0} max={180} inputMode="numeric" defaultValue={p?.folga_min ?? 30} className={inputCls + ' mt-1 w-full'} /></label>
              </div>
              <button className={btn}>Salvar</button>
            </form>
          </details>
        </div>

        <div className="space-y-6">
          <section className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-medium">Semana de {fmtData(dias[0])} a {fmtData(dias[6])}</h2>
              <div className="flex gap-2">
                <Link href={`/agenda?s=${addDays(seg, -7)}`} className={btn} aria-label="Semana anterior">‹</Link>
                <Link href="/agenda" className={btn}>Esta semana</Link>
                <Link href={`/agenda?s=${addDays(seg, 7)}`} className={btn} aria-label="Próxima semana">›</Link>
              </div>
            </div>
            {pontuaisAnteriores && <form action={copiarEscalaAnterior} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3 text-sm">
              <input type="hidden" name="semana" value={seg} />
              <span className="flex-1 text-muted">A escala mudou pouco? Copie os horários de um dia só (plantões, enfermarias) da semana anterior e depois ajuste.</span>
              {daSemana.length > 0 && <label className="flex w-full items-center gap-2 sm:order-last"><input type="checkbox" name="modo" value="substituir" defaultChecked className="accent-brand" />
                Substituir os {daSemana.length} {daSemana.length === 1 ? 'horário' : 'horários'} de um dia só que já estão nesta semana (sem marcar, só entra o que falta)</label>}
              <button className={btn}>Copiar a semana anterior</button>
            </form>}
            <ul className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">{dias.map(d => {
              const blocos = ag.ocupados[d] ?? []
              return (
                <li key={d} className={`space-y-2 rounded-xl border bg-surface p-3 ${d === hoje ? 'border-brand' : 'border-line'} ${d < hoje ? 'opacity-60' : ''}`}>
                  <h3 className="text-sm"><span className="capitalize">{nomeDia(d)}</span> <span className="text-muted">{fmtData(d)}</span></h3>
                  {blocos.map((o, k) => (
                    <BlocoAgenda key={k} o={o} className="block rounded-lg border-l-4 bg-line/40 px-2 py-1 text-xs">
                      <span className="text-muted">{hora(o.ini)}–{hora(o.fim)}</span> {o.titulo}</BlocoAgenda>))}
                  <p className="text-xs text-info">{ag.livres[d] ?? 'Dia livre na agenda'}</p>
                </li>)
            })}</ul>
          </section>

          <section className="space-y-3">
            <h2 className="font-medium">Seus horários</h2>
            {!ordenadas.length && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Nada na agenda ainda. Use um atalho ao lado para começar.</p>}
            <ul className="space-y-2">{ordenadas.map(l => (
              <li key={l.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-xl border border-line bg-surface p-3 text-sm">
                <span aria-hidden className="size-3 shrink-0 rounded-full" style={{ background: corDaCategoria(l.categoria, ag.cores) }} />
                <span className="min-w-0 flex-1"><b className="font-medium">{l.titulo}</b> <span className="text-muted">· {ehCategoria(l.categoria) ? CATEGORIAS[l.categoria].rotulo : 'Outro'}</span>
                  <span className="block text-muted">{quando(l)} · {l.hora_ini.slice(0, 5)}–{l.hora_fim.slice(0, 5)}{l.hora_fim < l.hora_ini ? ' (dia seguinte)' : ''}</span></span>
                {l.tipo === 'semanal' && <form action={pararDeRepetir}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="semana" value={seg} /><button className={btn}>Parar de repetir</button></form>}
                <form action={excluirDaAgenda}><input type="hidden" name="id" value={l.id} /><input type="hidden" name="semana" value={seg} />
                  <button className="rounded-lg px-3 py-1.5 text-sm text-danger hover:underline">Excluir{l.tipo === 'semanal' ? ' (todas as semanas)' : ''}</button></form>
              </li>))}</ul>
          </section>

          {!!antigos && <form action={trazerHorariosAntigos} className="space-y-2 rounded-2xl border border-line bg-surface p-5 text-sm">
            <input type="hidden" name="semana" value={seg} />
            <h2 className="font-medium">Horários do modelo antigo</h2>
            <p className="text-muted">Você tem {antigos} {antigos === 1 ? 'horário cadastrado' : 'horários cadastrados'} no modelo antigo de Minha semana. Quer trazê-los para a agenda? Depois é só apagar o que não vale mais.</p>
            <button className={btn}>Trazer para a agenda</button>
          </form>}
        </div>
      </div>}
    </div>)
}
