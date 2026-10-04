'use client'
import { useEffect, useState } from 'react'

/**
 * Marcar as questões para uma ação em lote (assunto, publicar, tirar do banco geral).
 * "Marcar todas desta página" marca as da página; se os filtros acham mais, aparece "Marcar todas as N destes filtros",
 * que manda `todas=1` junto com o formulário `form`: o servidor pega todas as questões dos filtros, não só as da página.
 * Desmarcar qualquer questão volta para a escolha de uma por uma.
 */
export default function MarcarTodas({ form, total, naPagina }: { form: string; total: number; naPagina: number }) {
  const [pagina, setPagina] = useState(false), [todas, setTodas] = useState(false)
  const caixas = () => document.querySelectorAll<HTMLInputElement>(`input[type=checkbox][name=sel][form="${form}"]`)
  const marcarPagina = (v: boolean) => { caixas().forEach(c => { c.checked = v }); setPagina(v); if (!v) setTodas(false) }
  useEffect(() => {
    const f = (e: Event) => { const t = e.target as HTMLInputElement; if (t.name === 'sel' && t.getAttribute('form') === form && !t.checked) { setPagina(false); setTodas(false) } }
    document.addEventListener('change', f); return () => document.removeEventListener('change', f)
  }, [form])
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
      <label className="flex items-center gap-2 text-muted">
        <input type="checkbox" checked={pagina} onChange={e => marcarPagina(e.target.checked)} className="size-4 accent-brand" />Marcar todas desta página</label>
      {pagina && total > naPagina && (todas
        ? <span role="status" className="text-brand">Todas as {total} questões destes filtros estão marcadas.{total > 2000 ? ' (Vão as 2000 primeiras.)' : ''}
            <button type="button" onClick={() => marcarPagina(false)} className="ml-2 text-muted hover:underline">Desmarcar</button></span>
        : <button type="button" onClick={() => setTodas(true)} className="text-brand hover:underline">Marcar todas as {total} destes filtros</button>)}
      {todas && <input type="hidden" name="todas" value="1" form={form} />}
    </div>)
}
