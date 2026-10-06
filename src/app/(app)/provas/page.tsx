import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { iniciarTentativa } from '@/lib/provas'
import { fazerProvaDoBanco } from '@/lib/banco'
import { sincronizarBancoGeral } from '@/lib/banco-data'
import { provasParaFazer, type ProvaGeral, type Ligacao, type MinhaQuestao } from '@/lib/engine/provas-banco'
import { relogio } from '@/lib/engine/provas'
import { pct } from '@/lib/engine/desempenho'
import { fmtData } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'

export default async function Provas({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams
  const sb = await supabaseServer()
  await sincronizarBancoGeral(sb) // as questões novas do banco geral (e das provas) chegam antes de contar
  // só as provas (as listas do banco de questões ficam na página do banco); sem a 0034, o campo "tipo" não existe e vêm todas
  let { data: provas, error } = await sb.from('provas').select('*').eq('tipo', 'prova').order('criada_em', { ascending: false })
  if (error) ({ data: provas, error } = await sb.from('provas').select('*').order('criada_em', { ascending: false }))
  const [{ data: qs }, { data: ts }, { data: pgs, error: ePg }, { data: ligs }, { data: minhas }] = await Promise.all([
    sb.from('prova_questoes').select('prova_id,gabarito,anulada').limit(20000),
    sb.from('prova_tentativas').select('id,prova_id,status,tempo_seg,atual,total,acertos,corrigida_em,iniciada_em').order('iniciada_em', { ascending: false }),
    sb.from('provas_geral').select('id,nome,banca,ano,total'),
    sb.from('prova_geral_questoes').select('prova_id,geral_id,numero').limit(30000),
    sb.from('banco_questoes').select('origem_geral,gabarito,anulada').not('origem_geral', 'is', null).limit(30000),
  ])
  const doBanco = ePg ? [] : provasParaFazer((pgs ?? []) as ProvaGeral[], (ligs ?? []) as Ligacao[], (minhas ?? []) as MinhaQuestao[])
  // a última nota e a tentativa em andamento de cada prova do banco (pelas provas da conta montadas a partir dela)
  const tentativasDe = (id: string) => { const ids = new Set((provas ?? []).filter(p => p.prova_geral === id).map(p => p.id)); return (ts ?? []).filter(t => ids.has(t.prova_id)) }
  const fazer = (id: string, rotulo: string, cls: string) => (
    <form action={fazerProvaDoBanco}><input type="hidden" name="prova" value={id} /><input type="hidden" name="volta" value="/provas" />
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
        {!doBanco.length && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-sm text-muted">{ePg ? 'As provas do banco ainda não estão ativas (falta atualizar o banco de dados).' : 'Ainda não há provas no banco. Elas vão sendo adicionadas pela administração.'}</p>}
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{doBanco.map(p => { const tt = tentativasDe(p.id), u = tt.find(t => t.status === 'corrigida'), a = tt.find(t => t.status !== 'corrigida'); return (
          <li key={p.id} className="flex flex-col gap-2 rounded-2xl border border-line bg-surface p-4">
            <b className="font-medium">{p.nome}</b>
            <p className="text-sm text-muted">{p.completa ? `${p.total} questões` : <span className="text-warn">{p.disponiveis} de {p.total} questões (incompleta)</span>}</p>
            {u && <p className="text-sm text-muted">Última: <b className="text-inherit">{u.acertos}/{u.total} ({pct(u.acertos ?? 0, u.total ?? 0)}%)</b> em {fmtData(u.corrigida_em?.slice(0, 10))}</p>}
            <div className="mt-auto">{a ? <Link href={`/provas/tentativa/${a.id}`} className={`${btn} inline-block bg-brand font-medium text-black`}>Continuar · questão {a.atual}</Link>
              : fazer(p.id, u ? 'Refazer a prova' : 'Fazer a prova', `${btn} bg-brand font-medium text-black`)}</div>
          </li>) })}</ul>
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
