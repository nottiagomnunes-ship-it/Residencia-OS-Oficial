import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { adicionarErro, marcarRevisado, excluirErro } from '@/lib/questoes'
import { hojeBR } from '@/lib/dates'
import { addDays } from '@/lib/engine/review'
import { MOTIVOS, estatisticasErros, type Motivo } from '@/lib/engine/questoes'
import { fmtData, inputCls } from '@/components/ui'
import { AlvoSelect } from '@/components/AlvoSelect'

import { carregarAreas, comArea } from '@/lib/areas-data'
export default async function CadernoDeErros({ searchParams }: { searchParams: Promise<{ m?: string }> }) {
  const { m } = await searchParams, hoje = hojeBR()
  const filtro = m && m in MOTIVOS ? (m as Motivo) : null
  const sb = await supabaseServer()
  const areas = await carregarAreas(sb)
  const [{ data: ds }, { data: ts }, { data: todos }] = await Promise.all([
    sb.from('disciplines').select('id,nome').order('ordem'), sb.from('topics').select('id,nome,discipline_id').order('nome'),
    sb.from('error_notebook').select('id,motivo,enunciado,comentario,revisar_em,revisado,disciplines(nome),topics(nome)').order('created_at', { ascending: false }).limit(1000),
  ])
  const erros = (todos ?? []) as any[], est = estatisticasErros(erros)
  const paraHoje = erros.filter(e => !e.revisado && e.revisar_em && e.revisar_em <= hoje)
  const lista = filtro ? erros.filter(e => e.motivo === filtro) : erros
  const chip = (on: boolean) => `rounded-full border px-3 py-1 text-sm ${on ? 'border-brand text-brand' : 'border-line text-muted'}`
  const Item = ({ e }: { e: any }) => (
    <li className={`space-y-2 rounded-2xl border border-line bg-surface p-4 ${e.revisado ? 'opacity-60' : ''}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="font-medium">{e.topics?.nome ?? e.disciplines?.nome}<span className="ml-2 text-sm font-normal text-muted">{e.topics ? e.disciplines?.nome : 'geral'}</span></span>
        <span className={`text-sm ${MOTIVOS[e.motivo as Motivo].cor}`}>{MOTIVOS[e.motivo as Motivo].rotulo}</span>
      </div>
      {e.enunciado && <p className="whitespace-pre-line text-sm">{e.enunciado}</p>}
      {e.comentario && <p className="whitespace-pre-line text-sm text-muted">{e.comentario}</p>}
      <div className="flex flex-wrap items-center gap-3 text-sm">
        <span className="text-muted">{e.revisado ? 'Revisado' : e.revisar_em ? `Revisar em ${fmtData(e.revisar_em)}` : 'Sem data de revisão'}</span>
        {!e.revisado && <form action={marcarRevisado}><input type="hidden" name="id" value={e.id} /><button className="rounded-lg border border-line px-3 py-1 hover:border-brand">Marcar como revisado</button></form>}
        <form action={excluirErro}><input type="hidden" name="id" value={e.id} /><button className="text-danger hover:underline">Excluir</button></form>
      </div>
    </li>)
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Caderno de Erros</h1>
      {est.frase && <p className="rounded-xl border border-line bg-surface p-4">{est.frase}</p>}
      {est.total > 0 && (
        <div className="space-y-2 rounded-2xl border border-line bg-surface p-5">
          {est.linhas.map(l => (
            <div key={l.motivo} className="grid grid-cols-[10rem_1fr_3rem] items-center gap-3 text-sm">
              <span className={MOTIVOS[l.motivo].cor}>{MOTIVOS[l.motivo].rotulo}</span>
              <div className="h-2 overflow-hidden rounded-full bg-line"><div className={`h-full rounded-full ${MOTIVOS[l.motivo].barra}`} style={{ width: `${l.pct}%` }} /></div>
              <span className="text-right text-muted">{l.n}</span>
            </div>))}
        </div>)}
      <div className="space-y-6 lg:grid lg:grid-cols-[22rem_minmax(0,1fr)] lg:items-start lg:gap-6 lg:space-y-0">
      {paraHoje.length > 0 && <section className="space-y-3 lg:col-start-2"><h2 className="font-medium text-warn">Para revisar hoje ({paraHoje.length})</h2><ul className="space-y-3">{paraHoje.map(e => <Item key={e.id} e={e} />)}</ul></section>}
      <form action={adicionarErro} className="space-y-4 rounded-2xl border border-line bg-surface p-5 lg:col-start-1 lg:row-span-4 lg:row-start-1 lg:sticky lg:top-6 lg:self-start">
        <h2 className="font-medium">Adicionar erro</h2>
        <AlvoSelect ds={comArea(ds ?? [], areas.mapa)} ts={ts ?? []} />
        <fieldset>
          <legend className="mb-2 text-sm text-muted">Por que você errou?</legend>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-2">{(Object.keys(MOTIVOS) as Motivo[]).map((k, i) => (
            <label key={k} className="cursor-pointer">
              <input type="radio" name="motivo" value={k} required={i === 0} className="peer sr-only" />
              <span className="flex min-h-12 items-center justify-center rounded-xl border border-line px-3 text-center text-sm peer-checked:border-brand peer-checked:bg-brand/15 peer-checked:text-brand peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-brand">{MOTIVOS[k].rotulo}</span>
            </label>))}</div>
        </fieldset>
        <textarea name="enunciado" rows={3} placeholder="Questão (enunciado ou referência: banca, ano, número)" className={inputCls + ' w-full'} />
        <textarea name="comentario" rows={2} placeholder="O que você aprendeu com este erro?" className={inputCls + ' w-full'} />
        <label className="flex flex-wrap items-center gap-2 text-sm text-muted">Revisar em <input name="revisar_em" type="date" defaultValue={addDays(hoje, 7)} className={inputCls} /></label>
        <button className="w-full rounded-xl bg-brand px-4 py-3 font-medium text-black">Adicionar ao caderno</button>
      </form>
      <div className="flex flex-wrap gap-2 lg:col-start-2">
        <Link href="/caderno-de-erros" className={chip(!filtro)}>Todos</Link>
        {(Object.keys(MOTIVOS) as Motivo[]).map(k => <Link key={k} href={`/caderno-de-erros?m=${k}`} className={chip(filtro === k)}>{MOTIVOS[k].rotulo}</Link>)}
      </div>
      <ul className="space-y-3 lg:col-start-2">{lista.map(e => <Item key={e.id} e={e} />)}</ul>
      {!lista.length && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted lg:col-start-2">Nenhum erro por aqui. Depois de registrar questões, anote os erros para transformá-los em revisão.</p>}
      </div>
    </div>
  )
}
