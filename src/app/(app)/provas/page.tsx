import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { iniciarTentativa } from '@/lib/provas'
import { fazerProvaCompleta } from '@/lib/banco'
import { provasDoBanco, MINIMO_PROVA, type LinhaDoBanco } from '@/lib/engine/provas-banco'
import { relogio } from '@/lib/engine/provas'
import { pct } from '@/lib/engine/desempenho'
import { fmtData } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'

export default async function Provas({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams
  const sb = await supabaseServer()
  // só as provas (as listas do banco de questões ficam na página do banco); sem a 0034, o campo "tipo" não existe e vêm todas
  let { data: provas, error } = await sb.from('provas').select('*').eq('tipo', 'prova').order('criada_em', { ascending: false })
  if (error) ({ data: provas, error } = await sb.from('provas').select('*').order('criada_em', { ascending: false }))
  const [{ data: qs }, { data: ts }, { data: banco }] = await Promise.all([
    sb.from('prova_questoes').select('prova_id,gabarito,anulada').limit(20000),
    sb.from('prova_tentativas').select('id,prova_id,status,tempo_seg,atual,total,acertos,corrigida_em,iniciada_em').order('iniciada_em', { ascending: false }),
    sb.from('banco_questoes').select('banca,ano,gabarito,anulada').not('banca', 'is', null).not('ano', 'is', null).limit(20000),
  ])
  const doBanco = provasDoBanco((banco ?? []) as LinhaDoBanco[]), inteiras = doBanco.filter(p => p.questoes >= MINIMO_PROVA), poucas = doBanco.filter(p => p.questoes < MINIMO_PROVA)
  // a última vez que cada prova do banco foi feita (pela banca e ano das provas montadas do banco)
  const ultimaDe = (banca: string, ano: number) => {
    const ids = new Set((provas ?? []).filter(p => p.do_banco && p.banca === banca && p.ano === ano).map(p => p.id))
    return (ts ?? []).find(t => ids.has(t.prova_id) && t.status === 'corrigida')
  }
  const abertaDe = (banca: string, ano: number) => {
    const ids = new Set((provas ?? []).filter(p => p.do_banco && p.banca === banca && p.ano === ano).map(p => p.id))
    return (ts ?? []).find(t => ids.has(t.prova_id) && t.status !== 'corrigida')
  }
  const fazer = (p: { banca: string; ano: number }, rotulo: string, cls: string) => (
    <form action={fazerProvaCompleta}><input type="hidden" name="banca" value={p.banca} /><input type="hidden" name="ano" value={p.ano} /><input type="hidden" name="volta" value="/provas" />
      <button className={cls}>{rotulo}</button></form>)
  const btn = 'rounded-xl px-4 py-2 text-sm'
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Provas</h1>
      {ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{ok}</AvisoDaUrl>}
      {erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{erro}</AvisoDaUrl>}
      <p className="text-sm text-muted">Faça uma prova inteira do banco de questões, na ordem da prova e com cronômetro. Ao entregar, ela é corrigida pelo gabarito, o resultado entra em Simulados e no Desempenho, e o que você errou vai para o Caderno de Erros e para a fila de refazer.</p>
      {error && <p className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Para usar as provas, rode <code>supabase/migrations/0028_provas.sql</code> no SQL Editor do Supabase e recarregue a página.</p>}

      {!error && <section className="space-y-3">
        <h2 className="font-medium">Provas do banco</h2>
        {!inteiras.length && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">Ainda não há prova inteira no banco. As provas vão sendo adicionadas pela administração.</p>}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{inteiras.map(p => { const u = ultimaDe(p.banca, p.ano), a = abertaDe(p.banca, p.ano); return (
          <li key={`${p.banca}|${p.ano}`} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><b className="font-medium">{p.banca} {p.ano}</b><span className="text-sm text-muted">{p.questoes} questões</span></div>
            {u && <p className="text-sm text-muted">Última: <b className="text-inherit">{u.acertos}/{u.total} ({pct(u.acertos ?? 0, u.total ?? 0)}%)</b> em {fmtData(u.corrigida_em?.slice(0, 10))}</p>}
            <div className="mt-auto">{a ? <Link href={`/provas/tentativa/${a.id}`} className={`${btn} inline-block bg-brand font-medium text-black`}>Continuar · questão {a.atual}</Link>
              : fazer(p, u ? 'Refazer a prova' : 'Fazer a prova', `${btn} bg-brand font-medium text-black`)}</div>
          </li>) })}</ul>
        {poucas.length > 0 && <details className="text-sm">
          <summary className="cursor-pointer text-muted">Provas com poucas questões no banco ({poucas.length})</summary>
          <p className="mt-2 text-xs text-muted">Têm menos de {MINIMO_PROVA} questões no banco (em geral, vieram de listas por tema): dá para fazer, mas não é a prova inteira.</p>
          <ul className="mt-2 flex flex-wrap gap-2">{poucas.map(p => (
            <li key={`${p.banca}|${p.ano}`}>{fazer(p, `${p.banca} ${p.ano} · ${p.questoes}`, 'rounded-lg border border-line px-3 py-1.5 hover:border-brand')}</li>))}</ul>
        </details>}
        <p className="text-sm text-muted">Não achou a prova que queria? <Link href="/contato?pedir=prova#pedir-prova" className="text-brand underline">Peça a prova</Link>.</p>
      </section>}

      {(provas ?? []).length > 0 && <h2 className="font-medium">Suas provas</h2>}
      <ul className="grid gap-3 lg:grid-cols-2">{(provas ?? []).map(p => {
        const questoes = (qs ?? []).filter(q => q.prova_id === p.id), semGab = questoes.filter(q => !q.anulada && !q.gabarito).length
        const tents = (ts ?? []).filter(t => t.prova_id === p.id), aberta = tents.find(t => t.status !== 'corrigida'), feitas = tents.filter(t => t.status === 'corrigida')
        const ultima = feitas[0]
        return (
          <li key={p.id} className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <Link href={`/provas/${p.id}`} className="font-medium hover:text-brand">{p.nome}</Link>
              <span className="text-sm text-muted">{questoes.length} questões</span>
            </div>
            <p className="text-sm">{semGab ? <span className="text-warn">Falta o gabarito de {semGab} {semGab === 1 ? 'questão' : 'questões'}</span> : <span className="text-muted">Gabarito completo</span>}
              {ultima && <span className="text-muted"> · Última: <b className="text-inherit">{ultima.acertos}/{ultima.total} ({pct(ultima.acertos ?? 0, ultima.total ?? 0)}%)</b> em {fmtData(ultima.corrigida_em?.slice(0, 10))}</span>}
              {feitas.length > 1 && <span className="text-muted"> · feita {feitas.length} vezes</span>}</p>
            <div className="mt-auto flex flex-wrap gap-2">
              {aberta
                ? <Link href={`/provas/tentativa/${aberta.id}`} className={`${btn} bg-brand font-medium text-black`}>
                  {aberta.status === 'entregue' ? 'Corrigir (falta gabarito)' : `Continuar · questão ${aberta.atual} · ${relogio(aberta.tempo_seg)}`}</Link>
                : <form action={iniciarTentativa}><input type="hidden" name="prova" value={p.id} />
                  <button className={`${btn} bg-brand font-medium text-black`}>{feitas.length ? 'Refazer a prova' : 'Começar a prova'}</button></form>}
              {ultima && <Link href={`/provas/tentativa/${ultima.id}`} className={`${btn} border border-line hover:border-brand`}>Ver correção</Link>}
              <Link href={`/provas/${p.id}`} className={`${btn} border border-line hover:border-brand`}>{p.do_banco ? 'Detalhes' : 'Gabarito e áreas'}</Link>
            </div>
          </li>)
      })}</ul>
    </div>)
}
