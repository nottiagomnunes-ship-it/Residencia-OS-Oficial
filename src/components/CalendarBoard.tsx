'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { moverItem, adiarItem, concluirItem, excluirItem, editarItem } from '@/lib/calendar'
import { statusDe } from '@/lib/engine/calendar'
import { progressoEtapas, type Etapa, type Modelo } from '@/lib/engine/etapas'
import ChecklistRevisao from '@/components/ChecklistRevisao'
import Checklist from '@/components/Checklist'
import { minParaHhmm, type Intervalo } from '@/lib/engine/compromissos'
import { fmtData, inputCls } from '@/components/ui'
import Deslizavel from '@/components/Deslizavel'
import BotaoCronometro from '@/components/BotaoCronometro'
import { acaoDoGesto, rotuloDoGesto } from '@/lib/engine/gestos'
import { useMediaQuery } from '@/lib/useMediaQuery'

export type Item = { id: string; tipo: string; titulo: string; data: string; hora_ini: string | null; hora_fim: string | null; duracao_min: number | null; qtd_questoes: number | null; status: string; origem: string; review_id?: string | null; topic_id?: string | null }
const COR: Record<string, string> = { concluido: 'border-brand bg-brand/10', agendado: 'border-info bg-info/10', proximo: 'border-warn bg-warn/10', atrasado: 'border-danger bg-danger/10' }
const ROTULO: Record<string, string> = { concluido: 'Concluído', agendado: 'Agendado', proximo: 'Próximo', atrasado: 'Atrasado' }
const TIPO: Record<string, string> = { estudo: 'Estudo', revisao: 'Revisão', questoes: 'Questões', flashcards: 'Flashcards', simulado: 'Simulado' }
const TIPO_COR: Record<string, string> = { questoes: 'text-violet', flashcards: 'text-pink', simulado: 'text-violet' }
const SEMANA = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

export default function CalendarBoard({ items, dias, view, hoje, mes, ocupados, etapas, etapasRev, modelos }: { items: Item[]; dias: string[]; view: string; hoje: string; mes: string; ocupados: Record<string, Intervalo[]>; etapas: Record<string, Etapa[]>; etapasRev: Record<string, Etapa[]>; modelos: Modelo[] }) {
  const [sel, setSel] = useState<Item | null>(null)
  const tabletDeitado = useMediaQuery('(min-width: 1024px) and (max-width: 1279.98px)')
  const painel = tabletDeitado && view === 'dia' // dia no tablet deitado: a lista à esquerda e os detalhes da tarefa ao lado, sem janela por cima (a semana usa as 7 colunas e o mês, a grade larga)
  const denso = tabletDeitado && view === 'mes'  // mês no tablet deitado: grade larga como no computador, só que mais compacta, para o mês inteiro caber na tela
  const [diaAberto, setDiaAberto] = useState<string | null>(null) // dia cujo "+N mais" foi tocado
  const [novaData, setNovaData] = useState('')
  const [pending, start] = useTransition()
  const [diaSel, setDiaSel] = useState('') // dia aberto na visão de mês do celular
  const [editandoId, setEditandoId] = useState<string | null>(null), [ed, setEd] = useState({ titulo: '', hora: '', dur: '', qtd: '' }), [erro, setErro] = useState<string | null>(null)
  const run = (fn: () => Promise<unknown>) => start(async () => { await fn(); setSel(null) })
  /** Move/adia; se cair sobre um compromisso, pergunta antes de forçar. Cancelar não muda nada. */
  const mover = (fn: (forcar: boolean) => Promise<{ conflito?: string }>) => start(async () => {
    const r = await fn(false)
    if (r.conflito) { if (!window.confirm(`⚠ Conflito de horário\n\n${r.conflito}\n\nMover mesmo assim?`)) return; await fn(true) }
    setSel(null)
  })
  const abrirEdicao = () => {
    if (!sel) return
    setEd({ titulo: sel.titulo, hora: sel.hora_ini?.slice(0, 5) ?? '', dur: sel.duracao_min ? String(sel.duracao_min) : '', qtd: sel.qtd_questoes ? String(sel.qtd_questoes) : '' })
    setErro(null); setEditandoId(sel.id)
  }
  const salvar = () => sel && start(async () => {
    let r = await editarItem(sel.id, ed, false)
    if (!r.erro && r.conflito) { if (!window.confirm(`⚠ Conflito de horário\n\n${r.conflito}\n\nSalvar mesmo assim?`)) return; r = await editarItem(sel.id, ed, true) }
    if (r.erro) { setErro(r.erro); return }
    setEditandoId(null); setSel(null)
  })
  const nomeDia = (d: string) => new Date(d + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' }).replace('-feira', '')
  const cols = view === 'dia' ? 'grid-cols-1' : view === 'semana' ? 'grid-cols-1 md:grid-cols-7' : 'grid-cols-7'
  const compacto = view === 'mes'
  const diaAtivo = dias.includes(diaSel) ? diaSel : dias.includes(hoje) ? hoje : (dias.find(d => d.slice(0, 7) === mes) ?? dias[0])
  const doDia = (d: string) => ({ lista: items.filter(i => i.data === d), ocup: [...(ocupados[d] ?? [])].sort((a, b) => a.ini - b.ini) })
  const PONTO: Record<string, string> = { concluido: 'bg-brand', agendado: 'bg-info', proximo: 'bg-warn', atrasado: 'bg-danger' }
  const faixa = (o: Intervalo, k: number, miudo: boolean) => (
    <div key={'o' + k} title={`${o.titulo}: ${minParaHhmm(o.ini)} às ${o.fim >= 1440 ? '24:00' : minParaHhmm(o.fim)}`}
      className={`rounded-lg border-l-4 border-line bg-line/40 px-2 py-1 text-muted ${miudo ? 'hidden truncate text-[11px] md:block' : 'text-xs'}`}>
      {miudo ? minParaHhmm(o.ini) : `${minParaHhmm(o.ini)}–${o.fim >= 1440 ? '24:00' : minParaHhmm(o.fim)}`} {o.titulo}</div>)
  const cartao = (i: Item, miudo: boolean, semana = false) => {
    const st = statusDe(i, hoje)
    const card = (
      <div key={i.id} role="button" tabIndex={0} draggable={i.status !== 'concluido'}
        onDragStart={e => e.dataTransfer.setData('text/plain', i.id)} onClick={() => { setSel(i); setNovaData(i.data) }}
        onKeyDown={e => e.key === 'Enter' && (setSel(i), setNovaData(i.data))}
        className={`cursor-pointer rounded-lg border-l-4 ${painel && sel?.id === i.id ? 'ring-2 ring-brand' : ''} ${miudo ? `hidden truncate px-1.5 ${denso ? 'py-0.5 text-[11px]' : 'py-1.5 text-xs'} md:block` : semana ? 'px-3 py-2.5 text-sm md:px-2 md:py-1.5 md:text-xs xl:px-3 xl:py-2.5 xl:text-sm' : 'px-3 py-2.5 text-sm'} ${COR[st]}`}>
        {!miudo && <span className={`block text-xs ${semana ? 'md:text-[10px] xl:text-xs' : ''} ${TIPO_COR[i.tipo] ?? 'text-muted'}`}>{TIPO[i.tipo]}{i.hora_ini ? ` · ${i.hora_ini.slice(0, 5)}` : i.duracao_min ? ` · ${i.duracao_min} min` : ''}</span>}
        <span className={`${semana ? 'block break-words md:line-clamp-3 xl:line-clamp-none' : ''} ${st === 'concluido' ? 'line-through opacity-70' : ''}`}>{i.titulo}</span>
        {!miudo && i.topic_id && i.tipo === 'estudo' && etapas[i.topic_id]?.length > 0 && (() => { const p = progressoEtapas(etapas[i.topic_id!]); return <span className={`ml-2 text-xs ${p.completo ? 'text-brand' : 'text-muted'}`}>{p.completo ? '✓ ' : ''}etapas {p.feitas}/{p.total}</span> })()}
        {!miudo && i.tipo === 'revisao' && i.review_id && etapasRev[i.review_id]?.length > 0 && (() => { const p = progressoEtapas(etapasRev[i.review_id!]); return <span className={`ml-2 text-xs ${p.completo ? 'text-brand' : 'text-muted'}`}>{p.completo ? '✓ ' : ''}etapas {p.feitas}/{p.total}</span> })()}
      </div>)
    if (miudo || i.status === 'concluido') return card
    // deslizar no toque: para a direita conclui (ou abre o registro, nas tarefas com resultado); para a esquerda adia 1 dia
    const dir = acaoDoGesto('direita', i.tipo, i.status), esq = acaoDoGesto('esquerda', i.tipo, i.status)
    return (
      <Deslizavel key={i.id} direita={rotuloDoGesto(dir, i.tipo)} esquerda={rotuloDoGesto(esq, i.tipo)}
        onDireita={() => (dir === 'concluir' ? run(() => concluirItem(i.id)) : (setSel(i), setNovaData(i.data)))}
        onEsquerda={() => mover(f => adiarItem(i.id, f))}>{card}</Deslizavel>)
  }

  const detalhes = sel ? (
    <>
<div className="flex items-start justify-between gap-4">
              <div><p className={`text-sm ${TIPO_COR[sel.tipo] ?? 'text-muted'}`}>{TIPO[sel.tipo]} · {ROTULO[statusDe(sel, hoje)]}</p><h2 className="text-lg font-semibold">{sel.titulo}</h2></div>
              <button onClick={() => setSel(null)} aria-label="Fechar" className="p-2 text-muted">✕</button>
            </div>
            <p className="text-sm text-muted">{fmtData(sel.data)}{sel.hora_ini ? ` · ${sel.hora_ini.slice(0, 5)}${sel.hora_fim ? `–${sel.hora_fim.slice(0, 5)}` : ''}` : ''}{sel.duracao_min ? ` · ${sel.duracao_min} min` : ''}{sel.qtd_questoes ? ` · ${sel.qtd_questoes} questões` : ''}{sel.origem === 'auto' ? ' · gerada pelo sistema' : ''}</p>
            {sel.topic_id && sel.tipo === 'estudo' && (
              <Checklist key={sel.topic_id} topicId={sel.topic_id} inicial={etapas[sel.topic_id] ?? []} modelos={modelos} concluido={sel.status === 'concluido'} compacto />)}
            {sel.tipo === 'revisao' && sel.review_id && etapasRev[sel.review_id] && (
              <ChecklistRevisao key={sel.review_id} reviewId={sel.review_id} inicial={etapasRev[sel.review_id]} />)}
            {sel.status !== 'concluido' && <>
              <div className="flex flex-wrap gap-2">
                {sel.tipo === 'questoes' || sel.tipo === 'simulado'
                  ? <button onClick={() => run(() => concluirItem(sel.id))} className="rounded-xl border border-line px-4 py-2 text-sm">Marcar como feito (sem XP)</button>
                  : sel.tipo === 'revisao'
                    ? <><Link href="/revisoes" className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Fazer revisão</Link>
                      <button onClick={() => run(() => concluirItem(sel.id))} className="rounded-xl border border-line px-4 py-2 text-sm">Marcar como feita</button></>
                    : <button onClick={() => run(() => concluirItem(sel.id))} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">Concluir</button>}
                <BotaoCronometro itemId={sel.id} titulo={sel.titulo} variante="texto" />
                <button onClick={() => mover(f => adiarItem(sel.id, f))} className="rounded-xl border border-line px-4 py-2 text-sm">Adiar 1 dia</button>
                <button onClick={abrirEdicao} className="rounded-xl border border-line px-4 py-2 text-sm">Editar</button>
                {(sel.tipo === 'questoes' || sel.tipo === 'simulado') && <Link href={sel.tipo === 'simulado' ? '/simulados' : `/questoes?${[sel.topic_id ? `alvo=t:${sel.topic_id}` : '', sel.qtd_questoes ? `total=${sel.qtd_questoes}` : ''].filter(Boolean).join('&')}`}
                  className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black">{sel.tipo === 'simulado' ? 'Registrar simulado' : 'Registrar questões'}</Link>}
                <button onClick={() => confirm('Excluir esta tarefa?') && run(() => excluirItem(sel.id))} className="rounded-xl px-4 py-2 text-sm text-danger hover:bg-danger/10">Excluir</button>
              </div>
              <div className="flex items-center gap-2"><input type="date" value={novaData} onChange={e => setNovaData(e.target.value)} className={inputCls} aria-label="Nova data" />
                <button onClick={() => mover(f => moverItem(sel.id, novaData, f))} className="rounded-xl border border-line px-4 py-2 text-sm">Mover para esta data</button></div>
              {editandoId === sel.id && (
                <div className="space-y-3 rounded-xl border border-line p-3">
                  <input value={ed.titulo} onChange={e => setEd({ ...ed, titulo: e.target.value })} disabled={!!sel.review_id} aria-label="Título" className={inputCls + ' w-full disabled:opacity-60'} />
                  {sel.review_id && <p className="text-xs text-muted">O título de uma revisão vem do assunto. Você pode ajustar horário e duração.</p>}
                  <div className="flex flex-wrap gap-2">
                    <input type="time" value={ed.hora} onChange={e => setEd({ ...ed, hora: e.target.value })} aria-label="Horário" className={inputCls} />
                    <input type="number" inputMode="numeric" min={5} max={720} step={5} value={ed.dur} onChange={e => setEd({ ...ed, dur: e.target.value })} placeholder="Minutos" aria-label="Duração em minutos" className={inputCls + ' w-28'} />
                    {sel.tipo === 'questoes' && <input type="number" inputMode="numeric" min={1} value={ed.qtd} onChange={e => setEd({ ...ed, qtd: e.target.value })} placeholder="Nº de questões" aria-label="Número de questões" className={inputCls + ' w-36'} />}
                  </div>
                  {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
                  <div className="flex gap-2">
                    <button onClick={salvar} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-black">Salvar</button>
                    <button onClick={() => setEditandoId(null)} className="rounded-lg border border-line px-3 py-1.5 text-sm">Cancelar</button>
                  </div>
                </div>)}
            </>}
    </>) : null

  return (
    <div className={`${pending ? 'opacity-60' : ''} ${painel ? 'grid grid-cols-[minmax(0,1fr)_22rem] items-start gap-6' : ''}`}>
      <div className="min-w-0">
      {compacto && <div className="mb-1 grid grid-cols-7 text-center text-xs text-muted">{SEMANA.map(s => <div key={s}>{s}</div>)}</div>}
      <div className={`grid ${denso ? 'gap-1.5' : 'gap-2'} ${cols}`}>
        {dias.map(d => {
          const { lista, ocup } = doDia(d), fora = compacto && d.slice(0, 7) !== mes
          const pontos = [...(ocup.length ? ['bg-muted'] : []), ...lista.map(i => PONTO[statusDe(i, hoje)])]
          const secao = (
            <section onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id) mover(f => moverItem(id, d, f)) }}
              className={`${denso ? 'min-h-20 space-y-1 p-1.5' : view === 'semana' ? 'min-h-24 min-w-0 space-y-2.5 p-3 md:space-y-1.5 md:p-2 xl:space-y-2.5 xl:p-3' : 'min-h-24 space-y-2.5 p-3'} rounded-xl border bg-surface ${compacto ? 'hidden md:block' : ''} ${d === hoje ? 'border-brand' : 'border-line'} ${fora ? 'opacity-40' : ''}`}>
              {view === 'semana' ? (
                <>
                  <h3 className="text-sm md:hidden"><span className="capitalize">{nomeDia(d)}</span> <span className="text-muted">{d.slice(8)}/{d.slice(5, 7)}</span></h3>
                  <div className="hidden text-center md:block">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-muted">{nomeDia(d)}</p>
                    <p className="text-xl font-semibold leading-tight">{+d.slice(8)}<span className="text-xs font-normal text-muted">/{d.slice(5, 7)}</span></p>
                    <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] ${lista.length ? 'bg-brand/15 text-brand' : 'bg-info/15 text-info'}`}>{lista.length ? `${lista.length} ${lista.length === 1 ? 'tarefa' : 'tarefas'}` : 'Livre'}</span>
                  </div>
                </>)
                : <h3 className="text-sm">{compacto ? +d.slice(8) : <><span className="capitalize">{nomeDia(d)}</span> <span className="text-muted">{d.slice(8)}/{d.slice(5, 7)}</span></>}</h3>}
              {ocup.map((o, k) => faixa(o, k, compacto))}
              {(denso ? lista.slice(0, 3) : lista).map(i => cartao(i, compacto, view === 'semana'))}
              {denso && lista.length > 3 && (
                <button type="button" onClick={() => setDiaAberto(d)} aria-label={`Ver as ${lista.length} tarefas de ${nomeDia(d)}, ${d.slice(8)}/${d.slice(5, 7)}`}
                  className="block w-full rounded-lg px-1.5 py-0.5 text-left text-[11px] text-brand hover:bg-line/40">+{lista.length - 3} mais</button>)}
            </section>)
          if (!compacto) return <div key={d} className="contents">{secao}</div>
          return (
            <div key={d} className="contents">
              <button type="button" onClick={() => setDiaSel(d)} aria-pressed={d === diaAtivo}
                aria-label={`${nomeDia(d)}, ${d.slice(8)}/${d.slice(5, 7)}: ${lista.length} ${lista.length === 1 ? 'tarefa' : 'tarefas'}`}
                className={`flex min-h-16 w-full flex-col items-center gap-1.5 rounded-xl border p-1.5 text-sm md:hidden ${d === hoje ? 'border-brand' : 'border-line'} ${d === diaAtivo ? 'bg-brand/15' : 'bg-surface'} ${fora ? 'opacity-40' : ''}`}>
                <span>{+d.slice(8)}</span>
                <span aria-hidden className="flex flex-wrap justify-center gap-1">{pontos.slice(0, 6).map((c, k) => <span key={k} className={`size-2 rounded-full ${c}`} />)}{pontos.length > 6 && <span className="text-[10px] leading-none text-muted">+</span>}</span>
              </button>
              {secao}
            </div>)
        })}
      </div>

      {compacto && (() => {
        const { lista, ocup } = doDia(diaAtivo)
        return (
          <section className="mt-4 space-y-2.5 md:hidden" aria-label="Tarefas do dia selecionado">
            <h3 className="font-medium"><span className="capitalize">{nomeDia(diaAtivo)}</span> <span className="text-muted">{fmtData(diaAtivo)}</span></h3>
            {ocup.map((o, k) => <div key={'a' + k} className="rounded-lg border-l-4 border-line bg-line/40 px-3 py-2 text-sm text-muted">{minParaHhmm(o.ini)}–{o.fim >= 1440 ? '24:00' : minParaHhmm(o.fim)} {o.titulo}</div>)}
            {lista.map(i => cartao(i, false))}
            {!lista.length && !ocup.length && <p className="text-sm text-muted">Nada neste dia.</p>}
          </section>)
      })()}
      </div>
      {painel && (
        <aside aria-label="Detalhes da tarefa" className="sticky top-4 max-h-[calc(100dvh-2rem)] space-y-4 overflow-y-auto rounded-2xl border border-line bg-surface p-5">
          {detalhes ?? <p className="text-sm text-muted">Toque numa tarefa para ver os detalhes aqui. No toque, deslize a tarefa para a direita para concluir e para a esquerda para adiar.</p>}
        </aside>)}
      {diaAberto && !sel && (
        <div className="fixed inset-0 z-40 grid place-items-center bg-black/60" onClick={() => setDiaAberto(null)}>
          <div role="dialog" aria-modal="true" aria-label="Tarefas do dia" onClick={e => e.stopPropagation()} className="max-h-[85dvh] w-full max-w-md space-y-3 overflow-y-auto rounded-2xl border border-line bg-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <h3 className="font-medium"><span className="capitalize">{nomeDia(diaAberto)}</span> <span className="text-muted">{fmtData(diaAberto)}</span></h3>
              <button onClick={() => setDiaAberto(null)} aria-label="Fechar" className="p-1 text-muted hover:text-brand">✕</button>
            </div>
            {doDia(diaAberto).lista.map(i => cartao(i, false))}
            {!doDia(diaAberto).lista.length && <p className="text-sm text-muted">Nada neste dia.</p>}
          </div>
        </div>)}
      {!painel && sel && (
        <div className="fixed inset-0 z-40 grid place-items-end bg-black/60 md:place-items-center" onClick={() => setSel(null)}>
          <div role="dialog" aria-modal="true" aria-label={sel.titulo} onClick={e => e.stopPropagation()} className="max-h-[90dvh] w-full max-w-md space-y-4 overflow-y-auto rounded-t-2xl border border-line bg-surface p-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] md:rounded-2xl">
            {detalhes}
          </div>
        </div>)}
    </div>
  )
}
