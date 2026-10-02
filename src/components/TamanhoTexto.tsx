'use client'
import { useState } from 'react'
import { TAMANHOS, ROTULOS_TAMANHO, type Tamanho } from '@/lib/engine/texto'

/** Escolhe o tamanho do texto deste aparelho. Vale na hora (sem recarregar) e fica lembrado em um cookie, que o servidor lê para já entregar a página no tamanho certo. */
export default function TamanhoTexto({ inicial }: { inicial: Tamanho }) {
  const [atual, setAtual] = useState<Tamanho>(inicial)
  const escolher = (t: Tamanho) => {
    setAtual(t)
    document.documentElement.dataset.texto = t
    document.cookie = `texto=${t}; path=/; max-age=31536000; SameSite=Lax`
  }
  return (
    <div className="space-y-3">
      <div role="radiogroup" aria-label="Tamanho do texto" className="flex flex-wrap gap-2">
        {TAMANHOS.map(t => (
          <button key={t} type="button" role="radio" aria-checked={atual === t} onClick={() => escolher(t)}
            className={`rounded-xl border px-5 py-2 text-sm ${atual === t ? 'border-brand bg-brand/15 text-brand' : 'border-line hover:border-brand'}`}>{ROTULOS_TAMANHO[t]}</button>))}
      </div>
      <p className="text-xs text-muted">A mudança vale na hora, só neste aparelho. Com o texto maior, recolha o menu lateral (botão ‹) para o calendário ter mais espaço.</p>
    </div>)
}
