'use client'
import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { marcarTutorialVisto } from '@/lib/tutorial'
import { PASSOS_TUTORIAL } from '@/lib/engine/ajuda'

export const EVENTO_ABRIR_TUTORIAL = 'residencia-os:abrir-tutorial'

/**
 * Tutorial de boas-vindas. Abre sozinho só quando `primeiraVez` (conta nova que ainda não o viu) e já fica marcado como visto ao abrir,
 * para não voltar mesmo que a pessoa feche a aba no meio. Depois, abre de novo pela página Ajuda ("Rever o tutorial").
 */
export default function Tutorial({ primeiraVez }: { primeiraVez: boolean }) {
  const [aberto, setAberto] = useState(primeiraVez), [i, setI] = useState(0), marcado = useRef(false)
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => { if (primeiraVez && !marcado.current) { marcado.current = true; void marcarTutorialVisto().catch(() => {}) } }, [primeiraVez])
  useEffect(() => {
    const abrir = () => { setI(0); setAberto(true) }
    window.addEventListener(EVENTO_ABRIR_TUTORIAL, abrir)
    return () => window.removeEventListener(EVENTO_ABRIR_TUTORIAL, abrir)
  }, [])
  useEffect(() => {
    if (!aberto) return
    caixa.current?.focus()
    const f = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAberto(false)
      else if (e.key === 'ArrowRight') setI(x => Math.min(PASSOS_TUTORIAL.length - 1, x + 1))
      else if (e.key === 'ArrowLeft') setI(x => Math.max(0, x - 1))
    }
    window.addEventListener('keydown', f); return () => window.removeEventListener('keydown', f)
  }, [aberto])
  if (!aberto) return null
  const passo = PASSOS_TUTORIAL[i], ultimo = i === PASSOS_TUTORIAL.length - 1
  const fechar = () => setAberto(false)
  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/70 p-4">
      <div ref={caixa} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tutorial-titulo"
        className="w-full max-w-md space-y-5 rounded-2xl border border-line bg-surface p-6 shadow-xl outline-none">
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs text-muted">Passo {i + 1} de {PASSOS_TUTORIAL.length}</span>
          {!ultimo && <button type="button" onClick={fechar} className="rounded-lg px-2 py-1 text-sm text-muted hover:text-brand">Pular</button>}
        </div>
        <div className="space-y-2" aria-live="polite">
          <h2 id="tutorial-titulo" className="text-xl font-semibold">{passo.titulo}</h2>
          <p className="leading-relaxed">{passo.texto}</p>
          {passo.link && <Link href={passo.link.href} onClick={fechar} className="inline-block text-sm text-brand underline">{passo.link.rotulo} →</Link>}
        </div>
        <div className="flex justify-center gap-1.5" aria-hidden>{PASSOS_TUTORIAL.map((_, k) => <span key={k} className={`h-1.5 rounded-full ${k === i ? 'w-5 bg-brand' : 'w-1.5 bg-line'}`} />)}</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setI(x => x - 1)} disabled={i === 0} className="min-h-12 flex-1 rounded-xl border border-line disabled:opacity-40">Voltar</button>
          {ultimo
            ? <button type="button" onClick={fechar} className="min-h-12 flex-1 rounded-xl bg-brand font-medium text-on-cor">Começar</button>
            : <button type="button" onClick={() => setI(x => x + 1)} className="min-h-12 flex-1 rounded-xl bg-brand font-medium text-on-cor">Próximo</button>}
        </div>
      </div>
    </div>)
}

/** Botão da página Ajuda: abre o tutorial de novo (não muda nada no banco). */
export function RevisarTutorial() {
  return <button type="button" onClick={() => window.dispatchEvent(new Event(EVENTO_ABRIR_TUTORIAL))}
    className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Rever o tutorial</button>
}
