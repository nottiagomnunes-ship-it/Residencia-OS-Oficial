'use client'
import { useState, useTransition } from 'react'
import { adicionarEtapaRevisao, alternarEtapaRevisao, removerEtapaRevisao } from '@/lib/revisao-etapas'
import { PADRAO_REVISAO, TIPOS_ETAPA, progressoEtapas, type Etapa } from '@/lib/engine/etapas'
import { Bar, inputCls } from '@/components/ui'

/** Mini-checklist próprio de uma revisão. As etapas do assunto ficam no estudo, não aqui. */
export default function ChecklistRevisao({ reviewId, inicial }: { reviewId: string; inicial: Etapa[] }) {
  const [itens, setItens] = useState(inicial), [txt, setTxt] = useState(''), [, start] = useTransition()
  const p = progressoEtapas(itens)
  const faltam = PADRAO_REVISAO.filter(m => !itens.some(i => i.titulo === m.titulo))
  const alternar = (i: Etapa) => { setItens(l => l.map(x => (x.id === i.id ? { ...x, concluida: !x.concluida } : x))); start(() => alternarEtapaRevisao(i.id, !i.concluida)) }
  const remover = (i: Etapa) => { setItens(l => l.filter(x => x.id !== i.id)); start(() => removerEtapaRevisao(i.id)) }
  const adicionar = (tipo: string, titulo: string, qtd: number | null) => start(async () => {
    const novo = await adicionarEtapaRevisao(reviewId, tipo, titulo, qtd)
    if (novo) setItens(l => [...l, novo])
  })
  return (
    <section className="space-y-3" aria-label="Etapas desta revisão">
      <div className="flex items-baseline justify-between"><h2 className="font-medium">Etapas desta revisão</h2><span className="text-sm text-muted">{p.feitas}/{p.total}</span></div>
      {p.total > 0 && <Bar pct={p.pct} />}
      <ul className="space-y-1">{itens.map(i => (
        <li key={i.id} className="flex items-center gap-3 rounded-xl px-2 py-2 hover:bg-line/40">
          <button onClick={() => alternar(i)} role="checkbox" aria-checked={i.concluida} aria-label={`${i.concluida ? 'Desmarcar' : 'Concluir'}: ${i.titulo}`}
            className={`grid size-7 shrink-0 place-items-center rounded-full border text-sm ${i.concluida ? 'border-brand bg-brand text-on-cor' : 'border-muted'}`}>{i.concluida ? '✓' : ''}</button>
          <span className={`min-w-0 flex-1 ${i.concluida ? 'text-muted line-through' : ''}`}>{i.titulo}<span className="ml-2 text-xs text-muted">{TIPOS_ETAPA[i.tipo]}</span></span>
          <button onClick={() => remover(i)} aria-label={`Excluir etapa: ${i.titulo}`} className="p-2 text-muted hover:text-danger">✕</button>
        </li>))}</ul>
      {!p.total && <p className="text-sm text-muted">Nenhuma etapa. Escolha um item abaixo ou escreva o seu.</p>}
      {faltam.length > 0 && (
        <div className="flex flex-wrap gap-2">{faltam.map(m => (
          <button key={m.titulo} onClick={() => adicionar(m.tipo, m.titulo, m.qtd_questoes)} className="rounded-full border border-line px-3 py-1 text-sm hover:bg-line/50">+ {m.titulo}</button>))}</div>)}
      <div className="flex gap-2">
        <input value={txt} onChange={e => setTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && txt.trim()) { adicionar('outro', txt, null); setTxt('') } }}
          placeholder="Outro item para esta revisão" aria-label="Novo item da revisão" className={inputCls + ' min-w-0 flex-1'} />
        <button onClick={() => { if (txt.trim()) { adicionar('outro', txt, null); setTxt('') } }} className="rounded-xl bg-brand px-4 text-sm font-medium text-on-cor">Adicionar</button>
      </div>
      <p className="text-xs text-muted">Cada revisão tem as suas etapas. As etapas do assunto ficam no estudo.</p>
    </section>)
}
