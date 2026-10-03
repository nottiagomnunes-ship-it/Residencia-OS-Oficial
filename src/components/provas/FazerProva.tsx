'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { responderQuestao, entregarProva, type RespostaParaGravar } from '@/lib/provas'
import { relogio, LETRAS, type Alternativa, type Letra } from '@/lib/engine/provas'
import type { BlocoNaTela } from '@/lib/provas-data'
import { Enunciado } from './Enunciado'

type Q = { id: string; numero: number; blocos: BlocoNaTela[]; alternativas: Alternativa[] }
type Estado = RespostaParaGravar
const VAZIO: Estado = { alternativa: null, chute: false, marcada: false, riscadas: '' }
const chave = (t: string) => `residencia-os:prova:${t}`
type Guardado = { pend: Record<string, Estado>; tempo: number }
const ler = (t: string): Guardado | null => { try { const v = JSON.parse(localStorage.getItem(chave(t)) ?? 'null'); return v && typeof v === 'object' ? v : null } catch { return null } }
const gravar = (t: string, g: Guardado) => { try { localStorage.setItem(chave(t), JSON.stringify(g)) } catch {} }
const apagar = (t: string) => { try { localStorage.removeItem(chave(t)) } catch {} }

/**
 * A prova em andamento. Cada toque é salvo no servidor na hora; sem internet, as respostas ficam guardadas neste aparelho e são enviadas quando a
 * conexão volta (o aviso no topo mostra quantas faltam). O relógio só anda com a prova aberta na tela.
 */
export default function FazerProva({ tentativa, nome, questoes, respostas, tempoInicial, atualInicial }:
  { tentativa: string; nome: string; questoes: Q[]; respostas: Record<string, Estado>; tempoInicial: number; atualInicial: number }) {
  const router = useRouter()
  const [est, setEst] = useState<Record<string, Estado>>(respostas)
  const [idx, setIdx] = useState(() => Math.max(0, questoes.findIndex(q => q.numero === atualInicial)))
  const [tempo, setTempo] = useState(tempoInicial)
  const [grade, setGrade] = useState(false), [confirmar, setConfirmar] = useState(false), [entregando, setEntregando] = useState(false)
  const [situacao, setSituacao] = useState<'salvo' | 'salvando' | 'pendente' | 'sessao'>('salvo'), [pendentes, setPendentes] = useState(0)
  const pend = useRef(new Map<string, Estado>()), rodando = useRef(false), tempoRef = useRef(tempoInicial), atualRef = useRef(atualInicial)
  const q = questoes[idx], e = est[q.id] ?? VAZIO

  const guardarLocal = useCallback(() => { gravar(tentativa, { pend: Object.fromEntries(pend.current), tempo: tempoRef.current }); setPendentes(pend.current.size) }, [tentativa])

  const enviar = useCallback(async () => {
    if (rodando.current) return
    rodando.current = true
    try {
      while (pend.current.size) {
        setSituacao('salvando')
        const [qid, estado] = pend.current.entries().next().value as [string, Estado]
        const r = await responderQuestao(tentativa, qid, estado, tempoRef.current, atualRef.current).catch(() => null)
        if (!r || !r.ok) { setSituacao(r && 'sessao' in r && r.sessao ? 'sessao' : 'pendente'); return }
        if (r.status !== 'ok') { apagar(tentativa); router.refresh(); return }           // entregue em outro aparelho
        if (pend.current.get(qid) === estado) pend.current.delete(qid)
        guardarLocal()
      }
      setSituacao('salvo')
    } finally { rodando.current = false }
  }, [tentativa, router, guardarLocal])

  // ao abrir: o que ficou guardado neste aparelho sem enviar vale mais que o do servidor
  useEffect(() => {
    const g = ler(tentativa)
    if (g) {
      const pendLocal = Object.entries(g.pend ?? {}).filter(([id]) => questoes.some(x => x.id === id))
      if (pendLocal.length) { setEst(s => ({ ...s, ...Object.fromEntries(pendLocal) })); pendLocal.forEach(([id, v]) => pend.current.set(id, v)) }
      if (g.tempo > tempoRef.current) { tempoRef.current = g.tempo; setTempo(g.tempo) }
      guardarLocal(); void enviar()
    }
    const online = () => void enviar()
    window.addEventListener('online', online)
    const tentar = setInterval(() => { if (pend.current.size) void enviar() }, 15000)
    return () => { window.removeEventListener('online', online); clearInterval(tentar) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // relógio: só conta com a página visível; a cada minuto o tempo vai para o servidor
  useEffect(() => {
    let seg = 0
    const t = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      tempoRef.current += 1; setTempo(tempoRef.current); seg++
      if (seg % 5 === 0) guardarLocal()
      if (seg % 60 === 0 && !pend.current.size) void responderQuestao(tentativa, null, null, tempoRef.current, atualRef.current).catch(() => {})
    }, 1000)
    return () => clearInterval(t)
  }, [tentativa, guardarLocal])

  useEffect(() => { atualRef.current = q.numero }, [q.numero])

  const mudar = (patch: Partial<Estado>) => {
    const novo = { ...e, ...patch }
    setEst(s => ({ ...s, [q.id]: novo }))
    pend.current.set(q.id, novo); guardarLocal(); void enviar()
  }
  const escolher = (l: Letra) => mudar({ alternativa: e.alternativa === l ? null : l, riscadas: e.riscadas.replace(l, '') })
  const riscar = (l: Letra) => mudar({ riscadas: e.riscadas.includes(l) ? e.riscadas.replace(l, '') : e.riscadas + l, alternativa: e.alternativa === l ? null : e.alternativa })
  const ir = (i: number) => { setIdx(Math.min(questoes.length - 1, Math.max(0, i))); setGrade(false); window.scrollTo({ top: 0 }) }

  useEffect(() => {
    const f = (ev: KeyboardEvent) => {
      if (ev.target instanceof HTMLElement && ev.target.closest('input,textarea,select')) return
      if (ev.key === 'ArrowRight') ir(idx + 1)
      else if (ev.key === 'ArrowLeft') ir(idx - 1)
      else { const l = ev.key.toUpperCase(); if (l.length === 1 && q.alternativas.some(a => a.letra === l)) escolher(l as Letra) }
    }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  })

  const respondidas = useMemo(() => questoes.filter(x => est[x.id]?.alternativa).length, [est, questoes])
  const marcadas = useMemo(() => questoes.filter(x => est[x.id]?.marcada), [est, questoes])

  async function entregar() {
    setEntregando(true)
    await enviar()
    if (pend.current.size) { setEntregando(false); return }
    apagar(tentativa)
    await entregarProva(tentativa, tempoRef.current)
  }

  const aviso = { salvo: { t: 'Tudo salvo', c: 'text-muted' }, salvando: { t: 'Salvando…', c: 'text-muted' },
    pendente: { t: `Sem conexão: ${pendentes} ${pendentes === 1 ? 'resposta guardada' : 'respostas guardadas'} neste aparelho`, c: 'text-warn' },
    sessao: { t: 'Sua sessão expirou: entre de novo (as respostas estão guardadas neste aparelho)', c: 'text-danger' } }[situacao]

  const Grade = (
    <div className="space-y-3">
      <div className="grid grid-cols-8 gap-1.5 sm:grid-cols-10">{questoes.map((x, i) => {
        const r = est[x.id], atual = i === idx
        return <button key={x.id} type="button" onClick={() => ir(i)} aria-label={`Questão ${x.numero}${r?.alternativa ? `, respondida ${r.alternativa}` : ', em branco'}${r?.marcada ? ', marcada para revisar' : ''}`}
          aria-current={atual ? 'true' : undefined}
          className={`relative h-10 rounded-lg text-sm ${r?.alternativa ? 'bg-brand/20 text-brand' : 'bg-line/60 text-muted'} ${atual ? 'outline outline-2 outline-brand' : ''}`}>
          {x.numero}{r?.marcada && <span aria-hidden className="absolute right-0.5 top-0.5 size-2 rounded-full bg-warn" />}</button>
      })}</div>
      <p className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span><span aria-hidden className="mr-1 inline-block size-2.5 rounded bg-brand/40" />respondida</span>
        <span><span aria-hidden className="mr-1 inline-block size-2.5 rounded bg-line" />em branco</span>
        <span><span aria-hidden className="mr-1 inline-block size-2 rounded-full bg-warn" />voltar depois</span>
      </p>
    </div>)

  return (
    <div className="space-y-4">
      <header className="sticky top-0 z-20 -mx-4 flex flex-wrap items-center gap-x-4 gap-y-1 border-b border-line bg-bg/95 px-4 py-2 backdrop-blur md:-mx-8 md:px-8">
        <h1 className="min-w-0 flex-1 truncate font-semibold">{nome}</h1>
        <span className="font-mono text-lg" aria-label={`Tempo de prova ${relogio(tempo)}`}>{relogio(tempo)}</span>
        <span className="text-sm text-muted">{respondidas}/{questoes.length}</span>
        <p role="status" className={`w-full text-xs ${aviso.c}`}>{aviso.t}</p>
      </header>

      <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start lg:gap-6">
        <article className="space-y-4 rounded-2xl border border-line bg-surface p-4 md:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold">Questão {q.numero} <span className="text-sm font-normal text-muted">de {questoes.length}</span></h2>
            <button type="button" onClick={() => setGrade(g => !g)} aria-expanded={grade} className="rounded-xl border border-line px-3 py-2 text-sm lg:hidden">Ver todas</button>
          </div>
          {grade && <div className="lg:hidden">{Grade}</div>}
          <Enunciado blocos={q.blocos} numero={q.numero} />
          <ul className="space-y-2">{q.alternativas.map(a => {
            const marcada = e.alternativa === a.letra, riscada = e.riscadas.includes(a.letra)
            return (
              <li key={a.letra} className="flex items-stretch gap-2">
                <button type="button" onClick={() => escolher(a.letra)} aria-pressed={marcada}
                  className={`flex min-h-12 flex-1 items-start gap-3 rounded-xl border p-3 text-left transition-colors ${marcada ? 'border-brand bg-brand/15' : 'border-line hover:border-brand/60'} ${riscada ? 'opacity-50' : ''}`}>
                  <span className={`grid size-7 shrink-0 place-items-center rounded-full border text-sm font-semibold ${marcada ? 'border-brand bg-brand text-black' : 'border-line'}`}>{a.letra}</span>
                  <span className={`pt-0.5 whitespace-pre-line ${riscada ? 'line-through' : ''}`}>{a.texto}</span>
                </button>
                <button type="button" onClick={() => riscar(a.letra)} aria-pressed={riscada} aria-label={`${riscada ? 'Desfazer risco da' : 'Riscar a'} alternativa ${a.letra}`}
                  className={`w-11 shrink-0 rounded-xl border text-sm ${riscada ? 'border-warn text-warn' : 'border-line text-muted hover:text-warn'}`}>✕</button>
              </li>)
          })}</ul>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => mudar({ marcada: !e.marcada })} aria-pressed={e.marcada}
              className={`rounded-xl border px-4 py-2 text-sm ${e.marcada ? 'border-warn bg-warn/15 text-warn' : 'border-line'}`}>{e.marcada ? '★ Voltar depois' : '☆ Voltar depois'}</button>
            <button type="button" onClick={() => mudar({ chute: !e.chute })} aria-pressed={e.chute}
              className={`rounded-xl border px-4 py-2 text-sm ${e.chute ? 'border-info bg-info/15 text-info' : 'border-line'}`}>{e.chute ? '✓ Chutei' : 'Chutei'}</button>
          </div>
          <nav className="flex gap-2 border-t border-line pt-4" aria-label="Navegar entre as questões">
            <button type="button" onClick={() => ir(idx - 1)} disabled={idx === 0} className="min-h-12 flex-1 rounded-xl border border-line disabled:opacity-40">← Anterior</button>
            {idx < questoes.length - 1
              ? <button type="button" onClick={() => ir(idx + 1)} className="min-h-12 flex-1 rounded-xl bg-brand font-medium text-black">Próxima →</button>
              : <button type="button" onClick={() => setConfirmar(true)} className="min-h-12 flex-1 rounded-xl bg-brand font-medium text-black">Entregar prova</button>}
          </nav>
        </article>

        <aside className="hidden space-y-4 lg:sticky lg:top-20 lg:block">
          <div className="rounded-2xl border border-line bg-surface p-4">{Grade}</div>
        </aside>
      </div>

      <section className="space-y-3 rounded-2xl border border-line bg-surface p-4">
        {!confirmar
          ? <button type="button" onClick={() => setConfirmar(true)} className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Entregar prova…</button>
          : <div className="space-y-3">
            <p className="font-medium">Entregar a prova?</p>
            <p className="text-sm text-muted">{questoes.length - respondidas} em branco{marcadas.length ? ` · ${marcadas.length} marcadas para voltar (${marcadas.slice(0, 12).map(x => x.numero).join(', ')}${marcadas.length > 12 ? '…' : ''})` : ''}. Depois de entregar, as respostas não mudam mais.</p>
            {pendentes > 0 && <p className="text-sm text-warn">Ainda há {pendentes} {pendentes === 1 ? 'resposta' : 'respostas'} para enviar. Conecte-se à internet para entregar.</p>}
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={entregar} disabled={entregando} className="min-h-11 rounded-xl bg-brand px-5 font-medium text-black disabled:opacity-50">{entregando ? 'Entregando…' : 'Entregar agora'}</button>
              <button type="button" onClick={() => setConfirmar(false)} className="min-h-11 rounded-xl border border-line px-5">Continuar a prova</button>
            </div>
          </div>}
      </section>
      <p className="text-xs text-muted">Dica no teclado: ← → para navegar, {LETRAS.slice(0, 5).join('/')} para marcar.</p>
    </div>)
}
