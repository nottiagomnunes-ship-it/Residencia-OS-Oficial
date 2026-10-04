'use client'
import { useEffect, useState, type ReactNode } from 'react'

/**
 * As ações em lote só aparecem quando há questões marcadas (as caixas com form=`form`, ou "todas destes filtros").
 * Sem nada marcado, fica só uma linha dizendo para marcar: menos coisa na tela.
 */
export default function BarraDoLote({ form, children }: { form: string; children: ReactNode }) {
  const [n, setN] = useState(0), [todas, setTodas] = useState(false)
  useEffect(() => {
    const contar = () => {
      setN(document.querySelectorAll(`input[type=checkbox][name=sel][form="${form}"]:checked`).length)
      setTodas(!!document.querySelector(`input[type=hidden][name=todas][form="${form}"]`))
    }
    contar()
    const obs = new MutationObserver(contar) // "Marcar todas destes filtros" acrescenta/tira um campo escondido
    obs.observe(document.body, { childList: true, subtree: true })
    document.addEventListener('change', contar)
    return () => { obs.disconnect(); document.removeEventListener('change', contar) }
  }, [form])
  if (!n && !todas) return <p className="text-sm text-muted">Marque questões na lista para dar tema, publicar ou tirar do banco geral de várias de uma vez. Para mudar uma só, clique em <b>Editar</b>.</p>
  return (
    <section aria-label="Ações nas marcadas" className="sticky top-2 z-10 space-y-3 rounded-2xl border border-brand/50 bg-surface p-4 text-sm shadow-lg">
      <p className="font-medium">{todas ? 'Todas as questões destes filtros marcadas' : `${n} ${n === 1 ? 'questão marcada' : 'questões marcadas'}`}</p>
      {children}
    </section>)
}
