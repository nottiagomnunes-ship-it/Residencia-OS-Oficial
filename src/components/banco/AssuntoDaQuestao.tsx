'use client'
import { useState, useTransition } from 'react'
import { definirAssuntoDoBanco } from '@/lib/banco'
import { inputCls } from '@/components/ui'

export type TopicoSimples = { id: string; nome: string; discipline_id: string }
export type DiscSimples = { id: string; nome: string }

/**
 * Escolher o assunto de uma questão do banco: os assuntos de Matérias (os da disciplina da questão primeiro), "Sem assunto" ou um nome novo.
 * Grava na hora. Um nome novo pode virar também um assunto em Matérias (na disciplina escolhida), para contar no Desempenho do assunto.
 */
export default function AssuntoDaQuestao({ id, topicId, assunto, disciplinaId, assuntos, disciplinas, compacto = false }: {
  id: string; topicId: string | null; assunto: string | null; disciplinaId: string | null
  assuntos: TopicoSimples[]; disciplinas: DiscSimples[]; compacto?: boolean
}) {
  const [lista, setLista] = useState(assuntos)
  const [atual, setAtual] = useState({ topicId, assunto, disciplinaId })
  const [escrevendo, setEscrevendo] = useState(false), [texto, setTexto] = useState(''), [criarEm, setCriarEm] = useState(disciplinaId ?? '')
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null), [pend, start] = useTransition()

  const nomeDisc = new Map(disciplinas.map(d => [d.id, d.nome]))
  const grupos = [...new Set(lista.map(t => t.discipline_id))]
    .sort((a, b) => (a === atual.disciplinaId ? -1 : b === atual.disciplinaId ? 1 : (nomeDisc.get(a) ?? '').localeCompare(nomeDisc.get(b) ?? '')))
  const valor = atual.topicId ? `t:${atual.topicId}` : atual.assunto ? 'rotulo' : ''

  const salvar = (escolha: Parameters<typeof definirAssuntoDoBanco>[1], novo: typeof atual) => start(async () => {
    setMsg(null)
    const r = await definirAssuntoDoBanco([id], escolha).catch(() => ({ ok: false as const, erro: 'Sem conexão. Tente de novo.', topic: undefined, n: 0 }))
    if (!r.ok) { setMsg({ ok: false, t: r.erro ?? 'Não foi possível salvar.' }); return }
    if (r.topic) { setLista(l => [...l, r.topic!]); novo = { topicId: r.topic.id, assunto: r.topic.nome, disciplinaId: r.topic.discipline_id } }
    setAtual(novo); setEscrevendo(false); setTexto(''); setMsg({ ok: true, t: 'Salvo' })
  })
  const escolher = (v: string) => {
    if (v === 'outro') { setEscrevendo(true); return }
    setEscrevendo(false)
    if (v === '') salvar({ assunto: null }, { topicId: null, assunto: null, disciplinaId: atual.disciplinaId })
    else if (v.startsWith('t:')) { const t = lista.find(x => x.id === v.slice(2)); if (t) salvar({ topic_id: t.id }, { topicId: t.id, assunto: t.nome, disciplinaId: t.discipline_id }) }
  }
  const salvarTexto = () => {
    const nome = texto.trim(); if (!nome) return
    salvar({ assunto: nome, criar_em: criarEm || null }, { topicId: null, assunto: nome, disciplinaId: atual.disciplinaId })
  }

  return (
    <div className={`space-y-2 text-sm ${compacto ? '' : 'rounded-xl border border-line p-3'}`}>
      <label className="flex flex-wrap items-center gap-2"><span className="text-muted">Assunto</span>
        <select value={escrevendo ? 'outro' : valor} onChange={e => escolher(e.target.value)} disabled={pend} aria-label="Assunto da questão" className={inputCls + ' min-w-0 flex-1'}>
          <option value="">Sem assunto</option>
          {atual.assunto && !atual.topicId && <option value="rotulo">{atual.assunto} (só nome)</option>}
          {grupos.map(d => <optgroup key={d} label={nomeDisc.get(d) ?? 'Outra disciplina'}>
            {lista.filter(t => t.discipline_id === d).sort((a, b) => a.nome.localeCompare(b.nome)).map(t => <option key={t.id} value={`t:${t.id}`}>{t.nome}</option>)}</optgroup>)}
          <option value="outro">Outro (escrever)…</option>
        </select>
        {pend && <span className="text-xs text-muted">Salvando…</span>}
        {!pend && msg && <span role={msg.ok ? 'status' : 'alert'} className={`text-xs ${msg.ok ? 'text-brand' : 'text-danger'}`}>{msg.t}</span>}
      </label>
      {escrevendo && <div className="flex flex-wrap items-center gap-2">
        <input value={texto} onChange={e => setTexto(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); salvarTexto() } }} maxLength={120} autoFocus
          placeholder="Ex.: Bloqueio de neuroeixo" aria-label="Nome do assunto" className={inputCls + ' min-w-0 flex-1'} />
        {disciplinas.length > 0 && <select value={criarEm} onChange={e => setCriarEm(e.target.value)} aria-label="Criar em Matérias" className={inputCls}>
          <option value="">Só o nome (não criar em Matérias)</option>
          {disciplinas.map(d => <option key={d.id} value={d.id}>Criar em Matérias: {d.nome}</option>)}
        </select>}
        <button type="button" onClick={salvarTexto} disabled={pend || !texto.trim()} className="rounded-lg bg-brand px-3 py-1.5 font-medium text-black disabled:opacity-40">Salvar</button>
        <button type="button" onClick={() => setEscrevendo(false)} className="rounded-lg px-2 py-1.5 text-muted hover:underline">Cancelar</button>
      </div>}
    </div>)
}
