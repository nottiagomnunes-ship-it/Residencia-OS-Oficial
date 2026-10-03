'use client'
import { useState } from 'react'
import { classificarErro } from '@/lib/provas'
import { MOTIVOS, type Motivo } from '@/lib/engine/questoes'
import type { Alternativa, Letra, Situacao } from '@/lib/engine/provas'
import type { BlocoNaTela } from '@/lib/provas-data'
import { AlvoSelect } from '@/components/AlvoSelect'
import { Enunciado } from './Enunciado'

export type ItemCorrecao = {
  erroId: string; numero: number; situacao: Situacao; chute: boolean; alternativa: Letra | null; gabarito: Letra | null
  motivo: Motivo | null; alvo: string; blocos: BlocoNaTela[]; alternativas: Alternativa[]
}
type Ds = { id: string; nome: string; area?: string | null }[]
type Ts = { id: string; nome: string; discipline_id: string }[]

const titulo = (i: ItemCorrecao) => i.situacao === 'branco' ? 'Em branco' : i.situacao === 'certa' ? 'Acertou no chute' : 'Errou'

/** Um erro da prova: o motivo (botões) e a disciplina/assunto. Cada escolha é salva na hora no caderno de erros. */
function Item({ i, ds, ts }: { i: ItemCorrecao; ds: Ds; ts: Ts }) {
  const [motivo, setMotivo] = useState<Motivo | null>(i.motivo), [estado, setEstado] = useState<'' | 'salvando' | 'salvo' | 'erro'>(''), [aberto, setAberto] = useState(false)
  const salvar = async (d: { motivo?: Motivo | null; alvo?: string }) => {
    setEstado('salvando')
    const r = await classificarErro(i.erroId, d).catch(() => ({ ok: false }))
    setEstado(r.ok ? 'salvo' : 'erro')
  }
  return (
    <li id={`q${i.numero}`} className="space-y-3 rounded-2xl border border-line bg-surface p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">Questão {i.numero} <span className={`ml-1 text-sm ${i.situacao === 'certa' ? 'text-info' : 'text-danger'}`}>{titulo(i)}</span></span>
        <span className="text-sm">Sua: <b>{i.alternativa ?? '—'}</b> · Certa: <b className="text-brand">{i.gabarito ?? '—'}</b></span>
      </div>
      <button type="button" onClick={() => setAberto(a => !a)} aria-expanded={aberto} className="text-sm text-muted hover:text-brand">{aberto ? 'Esconder a questão' : 'Ver a questão'}</button>
      {aberto && <div className="space-y-3 text-sm">
        <Enunciado blocos={i.blocos} numero={i.numero} />
        <ul className="space-y-1">{i.alternativas.map(a => (
          <li key={a.letra} className={`rounded-lg px-2 py-1 ${a.letra === i.gabarito ? 'bg-brand/15 text-brand' : a.letra === i.alternativa ? 'bg-danger/10 text-danger' : ''}`}><b>{a.letra})</b> {a.texto}</li>))}</ul>
      </div>}
      <fieldset>
        <legend className="mb-2 text-sm text-muted">Por que você errou?</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">{(Object.keys(MOTIVOS) as Motivo[]).map(k => (
          <button key={k} type="button" aria-pressed={motivo === k} onClick={() => { const v = motivo === k ? null : k; setMotivo(v); void salvar({ motivo: v }) }}
            className={`min-h-11 rounded-xl border px-2 text-center text-sm ${motivo === k ? 'border-brand bg-brand/15 text-brand' : 'border-line'}`}>{MOTIVOS[k].rotulo}</button>))}</div>
      </fieldset>
      <div onChange={ev => { const t = ev.target; if (t instanceof HTMLSelectElement && t.name === 'alvo') void salvar({ alvo: t.value }) }}>
        <AlvoSelect ds={ds} ts={ts} defaultValue={i.alvo} />
      </div>
      <p role="status" className={`text-xs ${estado === 'erro' ? 'text-danger' : 'text-muted'}`}>
        {estado === 'salvando' ? 'Salvando…' : estado === 'salvo' ? 'Salvo no caderno de erros.' : estado === 'erro' ? 'Não foi possível salvar. Tente de novo.' : ''}</p>
    </li>)
}

export default function CorrecaoErros({ itens, ds, ts }: { itens: ItemCorrecao[]; ds: Ds; ts: Ts }) {
  const [so, setSo] = useState(false)
  const lista = so ? itens.filter(i => !i.motivo) : itens
  return (
    <div className="space-y-3">
      <label className="flex items-center gap-2 text-sm text-muted"><input type="checkbox" checked={so} onChange={e => setSo(e.target.checked)} /> Só os que estavam sem motivo quando a página abriu</label>
      <ul className="space-y-3">{lista.map(i => <Item key={i.erroId} i={i} ds={ds} ts={ts} />)}</ul>
    </div>)
}
