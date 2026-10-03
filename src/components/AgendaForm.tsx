'use client'
import { useState } from 'react'
import { criarNaAgenda } from '@/lib/agenda'
import { CATEGORIAS, MODELOS, DIAS_CURTOS, type Categoria } from '@/lib/engine/agenda'
import { inputCls } from '@/components/ui'

/** Adicionar à agenda. Os atalhos só preenchem o formulário: você confere, ajusta e salva. */
export default function AgendaForm({ semana, hoje }: { semana: string; hoje: string }) {
  const [titulo, setTitulo] = useState(''), [categoria, setCategoria] = useState<Categoria>('internato')
  const [tipo, setTipo] = useState<'semanal' | 'pontual'>('semanal'), [dias, setDias] = useState<number[]>([1, 2, 3, 4, 5])
  const [ini, setIni] = useState('07:00'), [fim, setFim] = useState('13:00'), [data, setData] = useState(hoje), [chave, setChave] = useState(0)
  const usar = (m: (typeof MODELOS)[number]) => { setTitulo(m.titulo); setCategoria(m.categoria); setTipo(m.tipo); setDias(m.dias); setIni(m.ini); setFim(m.fim); setChave(k => k + 1) }
  const viraNoite = ini && fim && fim < ini
  const chip = (on: boolean) => `min-h-11 rounded-xl border px-3 text-sm ${on ? 'border-brand bg-brand/15 text-brand' : 'border-line'}`
  return (
    <form action={criarNaAgenda} key={chave} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <input type="hidden" name="semana" value={semana} />
      <h2 className="font-medium">Adicionar à agenda</h2>
      <div className="space-y-2">
        <p className="text-sm text-muted">Atalhos</p>
        <div className="flex flex-wrap gap-2">{MODELOS.map(m => <button key={m.rotulo} type="button" onClick={() => usar(m)} className="rounded-full border border-line px-3 py-1.5 text-xs hover:border-brand">{m.rotulo}</button>)}</div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm text-muted">Nome<input name="titulo" required maxLength={80} value={titulo} onChange={e => setTitulo(e.target.value)} placeholder="Ex.: Enfermaria, Academia, Dentista" className={inputCls + ' mt-1 w-full'} /></label>
        <label className="text-sm text-muted">Tipo<select name="categoria" value={categoria} onChange={e => setCategoria(e.target.value as Categoria)} className={inputCls + ' mt-1 w-full'}>
          {(Object.keys(CATEGORIAS) as Categoria[]).map(c => <option key={c} value={c}>{CATEGORIAS[c].rotulo}</option>)}</select></label>
      </div>
      <fieldset className="space-y-2">
        <legend className="text-sm text-muted">Repete?</legend>
        <input type="hidden" name="tipo" value={tipo} />
        <div className="grid grid-cols-2 gap-2">
          <button type="button" aria-pressed={tipo === 'semanal'} onClick={() => setTipo('semanal')} className={chip(tipo === 'semanal')}>Toda semana</button>
          <button type="button" aria-pressed={tipo === 'pontual'} onClick={() => setTipo('pontual')} className={chip(tipo === 'pontual')}>Só um dia</button>
        </div>
      </fieldset>
      {tipo === 'semanal'
        ? <fieldset className="space-y-2">
          <legend className="text-sm text-muted">Dias</legend>
          <div className="grid grid-cols-7 gap-1">{[1, 2, 3, 4, 5, 6, 0].map(d => (
            <label key={d} className="cursor-pointer">
              <input type="checkbox" name="dias" value={d} checked={dias.includes(d)} onChange={e => setDias(ds => e.target.checked ? [...ds, d] : ds.filter(x => x !== d))} className="peer sr-only" />
              <span className="flex min-h-11 items-center justify-center rounded-lg border border-line text-xs peer-checked:border-brand peer-checked:bg-brand/15 peer-checked:text-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand">{DIAS_CURTOS[d]}</span>
            </label>))}</div>
          <details className="text-sm"><summary className="cursor-pointer text-muted">Só por um período (opcional)</summary>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <label className="text-muted">A partir de<input type="date" name="valido_de" className={inputCls + ' mt-1 w-full'} /></label>
              <label className="text-muted">Até<input type="date" name="valido_ate" className={inputCls + ' mt-1 w-full'} /></label>
            </div></details>
        </fieldset>
        : <label className="block text-sm text-muted">Data<input type="date" name="data" required value={data} onChange={e => setData(e.target.value)} className={inputCls + ' mt-1 w-full'} /></label>}
      <div className="grid grid-cols-2 gap-3">
        <label className="text-sm text-muted">Começa<input type="time" name="hora_ini" required value={ini} onChange={e => setIni(e.target.value)} className={inputCls + ' mt-1 w-full'} /></label>
        <label className="text-sm text-muted">Termina<input type="time" name="hora_fim" required value={fim} onChange={e => setFim(e.target.value)} className={inputCls + ' mt-1 w-full'} /></label>
      </div>
      {viraNoite && <p className="text-xs text-info">Termina no dia seguinte (passa da meia-noite).</p>}
      <button className="w-full rounded-xl bg-brand px-4 py-3 font-medium text-black">Salvar na agenda</button>
    </form>)
}
