import Link from 'next/link'
import { supabaseServer } from '@/lib/supabase/server'
import { iniciarTentativa } from '@/lib/provas'
import { relogio } from '@/lib/engine/provas'
import { pct } from '@/lib/engine/desempenho'
import { fmtData } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'

export default async function Provas({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams
  const sb = await supabaseServer()
  // só as provas (as listas do banco de questões ficam na página do banco); sem a 0034, o campo "tipo" não existe e vêm todas
  let { data: provas, error } = await sb.from('provas').select('id,nome,banca,ano,criada_em').eq('tipo', 'prova').order('criada_em', { ascending: false })
  if (error) ({ data: provas, error } = await sb.from('provas').select('id,nome,banca,ano,criada_em').order('criada_em', { ascending: false }))
  const [{ data: qs }, { data: ts }] = await Promise.all([
    sb.from('prova_questoes').select('prova_id,gabarito,anulada').limit(20000),
    sb.from('prova_tentativas').select('id,prova_id,status,tempo_seg,atual,total,acertos,corrigida_em,iniciada_em').order('iniciada_em', { ascending: false }),
  ])
  const btn = 'rounded-xl px-4 py-2 text-sm'
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Provas</h1>
        {!error && <Link href="/provas/importar" className={`${btn} bg-brand font-medium text-black`}>Importar prova (.docx)</Link>}
      </div>
      {ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{ok}</AvisoDaUrl>}
      {erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{erro}</AvisoDaUrl>}
      <p className="text-sm text-muted">Faça a prova inteira aqui, com cronômetro. Ao entregar, ela é corrigida pelo gabarito, o resultado entra em Simulados e no Desempenho, e o que você errou vai para o Caderno de Erros.</p>
      {error && <p className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Para usar as provas, rode <code>supabase/migrations/0028_provas.sql</code> no SQL Editor do Supabase e recarregue a página.</p>}
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
              <Link href={`/provas/${p.id}`} className={`${btn} border border-line hover:border-brand`}>Gabarito e áreas</Link>
            </div>
          </li>)
      })}</ul>
      {!error && !provas?.length && <p className="rounded-2xl border border-dashed border-line p-8 text-center text-muted">Nenhuma prova ainda. Importe o arquivo .docx de uma prova para começar.</p>}
    </div>)
}
