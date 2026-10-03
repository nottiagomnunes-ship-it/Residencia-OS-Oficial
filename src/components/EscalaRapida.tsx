'use client'
import { useMemo, useState } from 'react'
import { salvarEscalaRapida } from '@/lib/agenda'
import { lerEscalaEmTexto, corDaCategoria, CATEGORIAS, DIAS_CURTOS, type CoresAgenda } from '@/lib/engine/agenda'
import { inputCls } from '@/components/ui'

/** Colar ou digitar a escala da semana; a prévia mostra o que vai entrar antes de salvar. */
export default function EscalaRapida({ semana, cores = {} }: { semana: string; cores?: CoresAgenda }) {
  const [texto, setTexto] = useState('')
  const r = useMemo(() => (texto.trim() ? lerEscalaEmTexto(texto, semana) : null), [texto, semana])
  const dia = (d: string) => `${DIAS_CURTOS[new Date(d + 'T12:00:00Z').getUTCDay()]} ${d.slice(8)}/${d.slice(5, 7)}`
  return (
    <form action={salvarEscalaRapida} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
      <input type="hidden" name="semana" value={semana} />
      <h2 className="font-medium">Escala em texto</h2>
      <p className="text-sm text-muted">Um por linha (ou separados por ";"). Os dias da semana caem na semana mostrada ao lado.</p>
      <textarea name="texto" rows={4} value={texto} onChange={e => setTexto(e.target.value)} className={inputCls + ' w-full font-mono'}
        placeholder={'seg 7-13 Enfermaria\nter 19-7 PS\nqua a sex 7-13 Ambulatório\nseg, qua e sex 18-19 Academia\n14/10 14h30-15h Dentista'} />
      {r && <div className="space-y-2 text-sm">
        {r.itens.length > 0 && <ul className="space-y-1">{r.itens.map((i, k) => (
          <li key={k} className="flex items-center gap-2"><span aria-hidden className="size-2.5 shrink-0 rounded-full" style={{ background: corDaCategoria(i.categoria, cores) }} />
            <span className="w-20 shrink-0 text-muted">{dia(i.data)}</span><span className="w-24 shrink-0">{i.hora_ini}–{i.hora_fim}</span>
            <span className="min-w-0 flex-1 truncate">{i.titulo} <span className="text-xs text-muted">· {CATEGORIAS[i.categoria].rotulo}</span></span></li>))}</ul>}
        {r.erros.map((e, k) => <p key={k} className="text-warn">{e}</p>)}
      </div>}
      <button disabled={!r?.itens.length} className="w-full rounded-xl bg-brand px-4 py-3 font-medium text-black disabled:opacity-50">
        {r?.itens.length ? `Adicionar ${r.itens.length} à agenda` : 'Adicionar à agenda'}</button>
    </form>)
}
