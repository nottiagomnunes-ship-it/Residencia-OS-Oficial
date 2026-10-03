'use client'
import { useMemo, useState } from 'react'
import Link from 'next/link'
import { FAQ, buscarNaAjuda } from '@/lib/engine/ajuda'
import { inputCls } from '@/components/ui'

/** Perguntas frequentes com busca (sem acento, todas as palavras). */
export default function BuscaAjuda() {
  const [termo, setTermo] = useState('')
  const secoes = useMemo(() => buscarNaAjuda(FAQ, termo), [termo])
  const total = secoes.reduce((n, s) => n + s.perguntas.length, 0)
  return (
    <div className="space-y-6">
      <label className="block">
        <span className="sr-only">Buscar nas perguntas</span>
        <input type="search" value={termo} onChange={e => setTermo(e.target.value)} placeholder="Buscar: revisão, backup, plantão, prova..." className={inputCls + ' w-full'} />
      </label>
      {termo.trim() && <p role="status" className="text-sm text-muted">{total ? `${total} ${total === 1 ? 'resposta' : 'respostas'}` : 'Nada encontrado. Tente outra palavra.'}</p>}
      {secoes.map(s => (
        <section key={s.titulo} className="space-y-2">
          <h2 className="font-medium">{s.titulo}</h2>
          <div className="divide-y divide-line rounded-2xl border border-line bg-surface">{s.perguntas.map(q => (
            <details key={q.p} open={!!termo.trim()} className="group px-4">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 py-3">
                <span>{q.p}</span><span aria-hidden className="text-muted transition-transform group-open:rotate-90">›</span></summary>
              <div className="space-y-2 pb-4 text-sm leading-relaxed text-muted">
                <p>{q.r}</p>
                {q.links?.length ? <p className="flex flex-wrap gap-3">{q.links.map(l => <Link key={l.href} href={l.href} className="text-brand underline">{l.rotulo}</Link>)}</p> : null}
              </div>
            </details>))}</div>
        </section>))}
    </div>)
}
