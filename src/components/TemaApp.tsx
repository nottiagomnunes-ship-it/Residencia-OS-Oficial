'use client'
import { useState } from 'react'
import { TEMAS, ROTULOS_TEMA, type Tema } from '@/lib/engine/tema'

/** Escolhe o tema (escuro, claro ou igual ao aparelho). Vale na hora e fica lembrado em um cookie, que o servidor lê para já entregar a página no tema certo. */
export default function TemaApp({ inicial }: { inicial: Tema }) {
  const [atual, setAtual] = useState<Tema>(inicial)
  const escolher = (t: Tema) => {
    setAtual(t)
    document.documentElement.dataset.tema = t
    document.cookie = `tema=${t}; path=/; max-age=31536000; SameSite=Lax`
  }
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Tema" className="flex flex-wrap gap-2">
        {TEMAS.map(t => (
          <button key={t} type="button" role="radio" aria-checked={atual === t} onClick={() => escolher(t)}
            className={`rounded-xl border px-5 py-2 text-sm ${atual === t ? 'border-brand bg-brand/15 text-brand' : 'border-line hover:border-brand'}`}>{ROTULOS_TEMA[t]}</button>))}
      </div>
      <p className="text-xs text-muted">O tema claro ajuda a estudar de dia; o escuro cansa menos à noite. &quot;Igual ao aparelho&quot; troca sozinho com o modo do celular ou computador.</p>
    </div>)
}
