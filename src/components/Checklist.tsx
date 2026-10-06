'use client'
import { useState, useTransition } from 'react'
import Link from 'next/link'
import { adicionarEtapa, adicionarDoModelo, adicionarModelo, alternarEtapa, excluirEtapa, renomearEtapa, salvarPadrao, excluirPadrao, alternarConjunto } from '@/lib/etapas'
import { concluirConteudo } from '@/lib/flow'
import { Bar, inputCls } from '@/components/ui'
import { TIPOS_ETAPA, tituloPadrao, progressoEtapas, type Etapa, type Modelo } from '@/lib/engine/etapas'

const COR: Record<string, string> = { video: 'text-info', leitura: 'text-violet', questoes: 'text-pink', flashcards: 'text-warn', outro: 'text-muted' }

export default function Checklist({ topicId, inicial, modelos: modelosIniciais, concluido, compacto = false }: { topicId: string; inicial: Etapa[]; modelos: Modelo[]; concluido: boolean; compacto?: boolean }) {
  const [itens, setItens] = useState(inicial), [modelos, setModelos] = useState(modelosIniciais), [gerenciar, setGerenciar] = useState(false)
  const [tipo, setTipo] = useState('video'), [titulo, setTitulo] = useState(''), [qtd, setQtd] = useState(''), [salvar, setSalvar] = useState(false)
  const [edId, setEdId] = useState<string | null>(null), [edTxt, setEdTxt] = useState(''), [edQtd, setEdQtd] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [, start] = useTransition()
  const p = progressoEtapas(itens), conjunto = modelos.filter(m => m.conjunto)

  const alternar = (i: Etapa) => { setItens(l => l.map(x => (x.id === i.id ? { ...x, concluida: !x.concluida } : x))); start(() => alternarEtapa(i.id, !i.concluida)) }
  const remover = (i: Etapa) => { setItens(l => l.filter(x => x.id !== i.id)); start(() => excluirEtapa(i.id)) }
  const usarModelo = (m: Modelo) => start(async () => { const n = await adicionarDoModelo(topicId, m.id); if (n) setItens(l => [...l, n]) })
  const aplicarConjunto = () => start(async () => { const novas = await adicionarModelo(topicId); setItens(l => [...l, ...novas]) })
  const removerPadrao = (m: Modelo) => { setModelos(l => l.filter(x => x.id !== m.id)); start(() => excluirPadrao(m.id)) }
  const marcarConjunto = (m: Modelo) => { setModelos(l => l.map(x => (x.id === m.id ? { ...x, conjunto: !x.conjunto } : x))); start(() => alternarConjunto(m.id, !m.conjunto)) }
  const editar = (i: Etapa) => { setEdId(i.id); setEdTxt(i.titulo); setEdQtd(i.qtd_questoes ? String(i.qtd_questoes) : ''); setErro(null) }
  const salvarEdicao = () => start(async () => {
    const n = edQtd ? Number(edQtd) : null, r = await renomearEtapa(edId!, edTxt, n)
    if (r.erro) { setErro(r.erro); return }
    setItens(l => l.map(x => (x.id === edId ? { ...x, titulo: edTxt.trim(), qtd_questoes: x.tipo === 'questoes' ? n : x.qtd_questoes } : x))); setEdId(null); setErro(null)
  })
  function adicionar(e: React.FormEvent) {
    e.preventDefault()
    const n = qtd ? Number(qtd) : null, t = titulo.trim() || tituloPadrao(tipo, n)
    if (!t) { setErro('Escreva o que precisa ser feito.'); return }
    setErro(null)
    start(async () => {
      const nova = await adicionarEtapa(topicId, tipo, t, n); if (nova) setItens(l => [...l, nova])
      if (salvar) { const m = await salvarPadrao(tipo, t, n, false); if (m) setModelos(l => [...l, m]) }
      setTitulo(''); setQtd(''); setSalvar(false)
    })
  }
  return (
    <div className="space-y-4">
      <section className={compacto ? 'space-y-3' : 'space-y-3 rounded-2xl border border-line bg-surface p-5'}>
        <div className="flex items-baseline justify-between"><h2 className="font-medium">Etapas</h2><span className="text-sm text-muted">{p.feitas}/{p.total}</span></div>
        {p.total > 0 && <Bar pct={p.pct} />}
        <ul className="space-y-1">{itens.map(i => (
          <li key={i.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl px-2 py-2 hover:bg-line/40">
            <button onClick={() => alternar(i)} role="checkbox" aria-checked={i.concluida} aria-label={`${i.concluida ? 'Desmarcar' : 'Concluir'}: ${i.titulo}`}
              className={`grid size-6 shrink-0 place-items-center rounded-full border text-sm ${i.concluida ? 'border-brand bg-brand text-on-cor' : 'border-muted'}`}>{i.concluida ? '✓' : ''}</button>
            {edId === i.id ? (
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
                <input autoFocus value={edTxt} onChange={e => setEdTxt(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') salvarEdicao(); if (e.key === 'Escape') setEdId(null) }} aria-label="Texto da etapa" className={inputCls + ' min-w-0 flex-1'} />
                {i.tipo === 'questoes' && <input type="number" inputMode="numeric" min={1} max={1000} value={edQtd} onChange={e => setEdQtd(e.target.value)} placeholder="Nº" aria-label="Número de questões" className={inputCls + ' w-20'} />}
                <button onClick={salvarEdicao} className="rounded-lg bg-brand px-3 py-1.5 text-sm font-medium text-on-cor">Salvar</button>
                <button onClick={() => setEdId(null)} className="rounded-lg border border-line px-3 py-1.5 text-sm">Cancelar</button>
              </span>
            ) : (<>
              <span className={`min-w-[9rem] flex-1 ${i.concluida ? 'text-muted line-through' : ''}`}>{i.titulo}<span className={`ml-2 text-xs ${COR[i.tipo]}`}>{TIPOS_ETAPA[i.tipo]}</span></span>
              {i.tipo === 'questoes' && !i.concluida && <Link href={`/questoes?alvo=t:${topicId}${i.qtd_questoes ? `&total=${i.qtd_questoes}` : ''}`} className="text-sm text-brand hover:underline">Registrar</Link>}
              <button onClick={() => editar(i)} aria-label={`Editar etapa: ${i.titulo}`} className="p-2 text-muted hover:text-brand">✎</button>
              <button onClick={() => remover(i)} aria-label={`Excluir etapa: ${i.titulo}`} className="p-2 text-muted hover:text-danger">✕</button>
            </>)}
          </li>))}</ul>
        {!p.total && <p className="text-sm text-muted">Nenhuma etapa ainda. Escolha um padrão ou escreva o seu próprio item.</p>}

        <div className="space-y-3 border-t border-line pt-4">
          <div className="flex items-center justify-between"><h3 className="text-sm text-muted">Adicionar um padrão</h3>
            <button onClick={() => setGerenciar(g => !g)} className="text-xs text-brand hover:underline">{gerenciar ? 'Terminar' : 'Gerenciar padrões'}</button></div>
          <div className="flex flex-wrap gap-2">{modelos.map(m => (
            <span key={m.id} className="inline-flex items-center overflow-hidden rounded-full border border-line text-sm">
              <button onClick={() => usarModelo(m)} className="px-3 py-1 hover:bg-line/50">+ {m.titulo}</button>
              {gerenciar && <>
                <button onClick={() => marcarConjunto(m)} aria-pressed={m.conjunto} title="Incluir no conjunto padrão" aria-label={`Conjunto padrão: ${m.titulo}`} className={`px-2 ${m.conjunto ? 'text-brand' : 'text-muted'}`}>★</button>
                <button onClick={() => removerPadrao(m)} aria-label={`Excluir padrão: ${m.titulo}`} className="px-2 text-muted hover:text-danger">✕</button></>}
            </span>))}</div>
          {!modelos.length && <p className="text-sm text-muted">Você não tem padrões. Escreva um item abaixo e marque “Salvar como padrão”.</p>}
          {gerenciar && <p className="text-xs text-muted">★ marca os padrões do conjunto padrão, aplicado de uma vez em assuntos sem etapas.</p>}
          {!p.total && conjunto.length > 0 && <button onClick={aplicarConjunto} className="text-sm text-brand hover:underline">Aplicar o conjunto padrão ({conjunto.length} {conjunto.length === 1 ? 'item' : 'itens'})</button>}
        </div>

        <form onSubmit={adicionar} className="space-y-2 border-t border-line pt-4">
          <h3 className="text-sm text-muted">Ou escreva um item</h3>
          <div className="flex flex-wrap items-center gap-2">
            <select value={tipo} onChange={e => setTipo(e.target.value)} aria-label="Tipo de etapa" className={inputCls}>{Object.entries(TIPOS_ETAPA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
            {tipo === 'questoes' && <input type="number" inputMode="numeric" min={1} max={1000} value={qtd} onChange={e => setQtd(e.target.value)} placeholder="Nº" aria-label="Número de questões" className={inputCls + ' w-20'} />}
            <input value={titulo} onChange={e => setTitulo(e.target.value)} placeholder={tituloPadrao(tipo, qtd ? Number(qtd) : null) || 'Descreva o que precisa fazer'} aria-label="Descrição da etapa" className={inputCls + ' min-w-0 flex-1'} />
            <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-on-cor">Adicionar</button>
          </div>
          <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={salvar} onChange={e => setSalvar(e.target.checked)} className="accent-brand" />Salvar como padrão para usar em outros assuntos</label>
        </form>
        {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
      </section>
      {!concluido && !compacto && (
        <section className={`rounded-2xl border p-5 ${p.completo ? 'border-brand/50 bg-brand/10' : 'border-line bg-surface'}`}>
          <h2 className="font-medium">{p.completo ? 'Todas as etapas concluídas' : 'Concluir o assunto'}</h2>
          <p className="text-sm text-muted">Ao concluir, o sistema registra o tempo, gera as revisões (D1, D7, D30…) e atualiza o progresso.</p>
          <form action={concluirConteudo} className="mt-3 flex items-center gap-2">
            <input type="hidden" name="topic_id" value={topicId} />
            <input name="duration_min" type="number" inputMode="numeric" min={0} defaultValue={60} aria-label="Minutos estudados" className={inputCls + ' w-24'} /><span className="text-sm text-muted">min</span>
            <button className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-on-cor">Concluir assunto</button>
          </form>
        </section>)}
    </div>
  )
}
