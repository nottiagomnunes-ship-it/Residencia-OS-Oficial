'use client'
import { useEffect, useState, useTransition } from 'react'
import Link from 'next/link'
import { proximaQuestao, responderPratica, type Correcao } from '@/lib/pratica'
import { classificarErro } from '@/lib/provas'
import { MOTIVOS, type Motivo } from '@/lib/engine/questoes'
import type { Letra } from '@/lib/engine/provas'
import type { QuestaoPratica } from '@/lib/banco-data'
import { Enunciado } from '@/components/provas/Enunciado'

/**
 * Praticar: uma questão por vez, com a correção na hora. Sem lista e sem entregar: cada resposta já conta (Desempenho, XP, Caderno de Erros).
 * Primeiro vêm as questões que você nunca fez, depois as que errou; as desta sessão não repetem.
 */
export default function Praticar({ filtros, titulo, inicial, total }: { filtros: Record<string, string>; titulo: string; inicial: QuestaoPratica | null; total: number }) {
  const [q, setQ] = useState(inicial), [restantes, setRestantes] = useState(total)
  const [escolha, setEscolha] = useState<Letra | null>(null), [chute, setChute] = useState(false), [riscadas, setRiscadas] = useState('')
  const [correcao, setCorrecao] = useState<Correcao | null>(null), [motivo, setMotivo] = useState<Motivo | null>(null)
  const [placar, setPlacar] = useState({ feitas: 0, certas: 0 }), [vistos, setVistos] = useState<string[]>(inicial ? [inicial.id] : [])
  const [erro, setErro] = useState<string | null>(null), [pend, start] = useTransition()

  const responder = () => { if (!q || !escolha || correcao) return; setErro(null); start(async () => {
    const r = await responderPratica(q.id, escolha, chute).catch(() => ({ ok: false as const, erro: 'Sem conexão. Tente de novo.' }))
    if (!r.ok) { setErro(r.erro); return }
    setCorrecao(r.correcao); setPlacar(p => ({ feitas: p.feitas + 1, certas: p.certas + (r.correcao.correta ? 1 : 0) }))
  }) }
  const proxima = () => start(async () => {
    setErro(null)
    const r = await proximaQuestao(filtros, vistos).catch(() => ({ questao: null, restantes: 0, erro: 'Sem conexão. Tente de novo.' }))
    if (r.erro) { setErro(r.erro); return }
    setQ(r.questao); setRestantes(r.restantes); setEscolha(null); setChute(false); setRiscadas(''); setCorrecao(null); setMotivo(null)
    if (r.questao) setVistos(v => [...v, r.questao!.id])
    window.scrollTo({ top: 0 })
  })
  const darMotivo = (m: Motivo) => { if (!correcao?.erroId) return; setMotivo(m); void classificarErro(correcao.erroId, { motivo: m }) }

  useEffect(() => {
    const f = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLElement && e.target.closest('input,textarea,select')) return
      if (e.key === 'Enter') { e.preventDefault(); if (correcao) proxima(); else responder(); return }
      const l = e.key.toUpperCase()
      if (!correcao && q?.alternativas.some(a => a.letra === l)) setEscolha(l as Letra)
    }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  })

  const pct = placar.feitas ? Math.round((placar.certas / placar.feitas) * 100) : null
  const topo = (
    <header className="flex flex-wrap items-center gap-x-4 gap-y-1">
      <div className="min-w-0 flex-1"><Link href="/banco" className="text-sm text-muted hover:text-brand">← Banco de questões</Link><h1 className="truncate text-xl font-semibold">Praticar: {titulo}</h1></div>
      <p className="text-sm" aria-live="polite">{placar.feitas ? <><b>{placar.certas} de {placar.feitas}</b> <span className={pct! >= 70 ? 'text-brand' : pct! >= 50 ? 'text-warn' : 'text-danger'}>· {pct}%</span></> : <span className="text-muted">Nenhuma respondida ainda</span>}</p>
    </header>)

  if (!q) return (
    <div className="space-y-6">{topo}
      <section className="space-y-3 rounded-2xl border border-line bg-surface p-6 text-center">
        <p className="text-lg font-medium">{placar.feitas ? 'Acabaram as questões desses filtros.' : 'Nenhuma questão com gabarito bate com esses filtros.'}</p>
        {placar.feitas > 0 && <p className="text-muted">Você fez {placar.feitas} {placar.feitas === 1 ? 'questão' : 'questões'} e acertou {placar.certas} ({pct}%). Os erros já estão no Caderno de Erros.</p>}
        <div className="flex flex-wrap justify-center gap-2"><Link href="/banco" className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Mudar os filtros</Link>
          <Link href="/caderno-de-erros" className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Abrir o Caderno de Erros</Link></div>
      </section>
    </div>)

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {topo}
      <article className="space-y-4 rounded-2xl border border-line bg-surface p-4 md:p-6">
        <p className="flex flex-wrap gap-x-2 text-xs text-muted">
          {q.banca && <span>{q.banca}{q.ano ? ` ${q.ano}` : ''}</span>}{q.assunto && <span>· {q.assunto}</span>}
          <span>· {q.vezes === 0 ? 'nunca feita' : `já feita ${q.vezes}× (acertou ${q.acertos})`}</span><span>· {restantes} {restantes === 1 ? 'questão' : 'questões'} nestes filtros</span>
        </p>
        <Enunciado blocos={q.blocos} numero={placar.feitas + 1} />
        <ul className="space-y-2">{q.alternativas.map(a => {
          const marcada = escolha === a.letra, riscada = riscadas.includes(a.letra)
          const cor = correcao ? (a.letra === correcao.gabarito ? 'border-brand bg-brand/15' : marcada ? 'border-danger bg-danger/10' : 'border-line opacity-70') : marcada ? 'border-brand bg-brand/15' : 'border-line hover:border-brand/60'
          return (
            <li key={a.letra} className="flex items-stretch gap-2">
              <button type="button" disabled={!!correcao} onClick={() => setEscolha(marcada ? null : a.letra)} aria-pressed={marcada}
                className={`flex min-h-12 flex-1 items-start gap-3 rounded-xl border p-3 text-left transition-colors ${cor} ${riscada && !correcao ? 'opacity-50' : ''}`}>
                <span className={`grid size-7 shrink-0 place-items-center rounded-full border text-sm font-semibold ${marcada && !correcao ? 'border-brand bg-brand text-black' : 'border-line'}`}>{a.letra}</span>
                <span className={`whitespace-pre-line pt-0.5 ${riscada && !correcao ? 'line-through' : ''}`}>{a.texto}</span>
              </button>
              {!correcao && <button type="button" onClick={() => setRiscadas(r => (r.includes(a.letra) ? r.replace(a.letra, '') : r + a.letra))} aria-pressed={riscada}
                aria-label={`${riscada ? 'Desfazer risco da' : 'Riscar a'} alternativa ${a.letra}`} className={`w-11 shrink-0 rounded-xl border text-sm ${riscada ? 'border-warn text-warn' : 'border-line text-muted'}`}>✕</button>}
            </li>)
        })}</ul>

        {!correcao
          ? <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
            <button type="button" onClick={() => setChute(c => !c)} aria-pressed={chute} className={`rounded-xl border px-4 py-2 text-sm ${chute ? 'border-info bg-info/15 text-info' : 'border-line'}`}>{chute ? '✓ Chutei' : 'Chutei'}</button>
            <button type="button" onClick={responder} disabled={!escolha || pend} className="ml-auto min-h-12 rounded-xl bg-brand px-6 font-medium text-black disabled:opacity-40">{pend ? 'Corrigindo…' : 'Responder'}</button>
          </div>
          : <div className="space-y-3 border-t border-line pt-4" role="status">
            <p className={`text-lg font-semibold ${correcao.correta ? 'text-brand' : 'text-danger'}`}>{correcao.correta ? (chute ? 'Certo (no chute: foi para o Caderno de Erros)' : 'Certo!') : `Errou. A correta é a ${correcao.gabarito}.`}
              {correcao.xp > 0 && <span className="ml-2 text-sm font-normal text-brand">+{correcao.xp} XP</span>}</p>
            {correcao.gabaritoIA && <p className="text-xs text-warn">Gabarito sugerido pela IA, não oficial: confira.</p>}
            {correcao.comentario && <p className="whitespace-pre-line rounded-lg bg-line/40 p-3 text-sm text-muted">{correcao.comentario}</p>}
            {!correcao.correta && correcao.erroId && (
              <fieldset><legend className="mb-2 text-sm text-muted">Já está no Caderno de Erros. Por que você errou? (opcional)</legend>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{(Object.keys(MOTIVOS) as Motivo[]).map(k => (
                  <button key={k} type="button" onClick={() => darMotivo(k)} aria-pressed={motivo === k}
                    className={`min-h-11 rounded-xl border px-2 text-sm ${motivo === k ? 'border-brand bg-brand/15 text-brand' : 'border-line'}`}>{MOTIVOS[k].rotulo}</button>))}</div>
              </fieldset>)}
            <div className="flex justify-end"><button type="button" onClick={proxima} disabled={pend} className="min-h-12 rounded-xl bg-brand px-6 font-medium text-black disabled:opacity-40">{pend ? 'Carregando…' : 'Próxima →'}</button></div>
          </div>}
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
      </article>
      <p className="text-xs text-muted">Teclado: A–E escolhe, Enter responde e passa para a próxima. Pode parar quando quiser: o que você respondeu já está salvo.</p>
    </div>)
}
