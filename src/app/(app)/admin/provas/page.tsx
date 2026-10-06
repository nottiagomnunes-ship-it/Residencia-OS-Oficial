import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { ehAdmin } from '@/lib/banco-data'
import { cadastrarProvaExistente } from '@/lib/provas-geral'
import { gruposSemProva, type GeralComNumero } from '@/lib/engine/provas-banco'
import { inputCls } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'
import { todasAsLinhas } from '@/lib/paginar'

/** Administração → Provas: as provas cadastradas no banco geral (o que aparece em Questões → Provas) e o que dá para cadastrar. */
export default async function ProvasAdmin({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const { ok, erro } = await searchParams
  const sb = await supabaseServer()
  if (!(await ehAdmin(sb))) redirect('/banco')
  const [{ data: ps, error }, { data: ligs }, { data: geral }] = await Promise.all([
    sb.from('provas_geral').select('id,nome,banca,ano,total').order('ano', { ascending: false }).order('nome'),
    todasAsLinhas((de, ate) => sb.from('prova_geral_questoes').select('prova_id,geral_id').order('prova_id').order('numero').range(de, ate), 30000),
    todasAsLinhas((de, ate) => sb.from('banco_geral').select('id,banca,ano,colecao,numero').not('numero', 'is', null).order('id').range(de, ate), 30000),
  ])
  const provas = (ps ?? []) as { id: string; nome: string; banca: string; ano: number; total: number }[]
  const ligadas = new Map<string, number>()
  for (const l of (ligs ?? []) as { prova_id: string }[]) ligadas.set(l.prova_id, (ligadas.get(l.prova_id) ?? 0) + 1)
  const grupos = gruposSemProva((geral ?? []) as GeralComNumero[], new Set(((ligs ?? []) as { geral_id: string }[]).map(l => l.geral_id)))
  const card = 'space-y-3 rounded-2xl border border-line bg-surface p-5 text-sm'
  return (
    <div className="space-y-6">
      {ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{ok}</AvisoDaUrl>}
      {erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{erro}</AvisoDaUrl>}
      <div><h1 className="text-2xl font-semibold">Provas</h1>
        <p className="text-sm text-muted">As provas que as contas veem em Questões → Provas. Uma prova é cadastrada ao importar o arquivo de uma prova inteira (marcando &quot;Este arquivo é uma prova inteira&quot;) ou aqui embaixo, com questões que já estão no banco. Questões avulsas e listas por tema não viram prova.</p></div>
      {error && <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">Rode <code>supabase/migrations/0050_provas_do_banco.sql</code> no SQL Editor do Supabase para ativar esta página.</p>}

      {!error && <section className="space-y-2">
        <h2 className="font-medium">Cadastradas ({provas.length})</h2>
        {!provas.length && <p className="text-sm text-muted">Nenhuma prova cadastrada ainda.</p>}
        <ul className="grid gap-2 sm:grid-cols-2">{provas.map(p => { const n = ligadas.get(p.id) ?? 0; return (
          <li key={p.id}><Link href={`/admin/provas/${p.id}`} className="flex h-full flex-col gap-1 rounded-2xl border border-line bg-surface p-4 text-sm hover:border-brand">
            <b className="font-medium">{p.nome}</b>
            <span className="text-muted">{p.banca} · {p.ano} · <span className={n >= p.total ? 'text-brand' : 'text-warn'}>{n} de {p.total} questões{n >= p.total ? '' : ' (incompleta)'}</span></span>
          </Link></li>) })}</ul>
      </section>}

      {!error && <section className={card}>
        <h2 className="font-medium">Cadastrar com questões que já estão no banco</h2>
        <p className="text-muted">Questões publicadas com o número na prova e que ainda não estão em nenhuma prova, por banca, ano e coleção. Confira o nome e o total antes de cadastrar. Questões sem número (de importações antigas) não aparecem: importe de novo o arquivo marcando &quot;prova inteira&quot; (não duplica, só preenche o número) ou o pacote com o campo &quot;numero&quot;.</p>
        {!grupos.length && <p className="text-muted">Nenhuma questão com número fora de prova.</p>}
        <ul className="space-y-3">{grupos.map(g => (
          <li key={`${g.banca}|${g.ano}|${g.colecao ?? ''}`}>
            <form action={cadastrarProvaExistente} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-[2fr_6rem_auto] sm:items-end">
              <p className="sm:col-span-3"><b className="font-medium">{g.banca} {g.ano}</b>{g.colecao ? ` · coleção "${g.colecao}"` : ''} <span className="text-muted">— {g.questoes} questões (maior número: {g.maior})</span></p>
              <input type="hidden" name="banca" value={g.banca} /><input type="hidden" name="ano" value={g.ano} /><input type="hidden" name="colecao" value={g.colecao ?? ''} />
              <label className="text-muted">Nome da prova<input name="nome" required defaultValue={g.colecao || `${g.banca} ${g.ano}`} maxLength={120} className={inputCls + ' mt-1 w-full'} /></label>
              <label className="text-muted">Questões<input name="total" required inputMode="numeric" defaultValue={Math.max(g.maior, g.questoes)} className={inputCls + ' mt-1 w-full'} /></label>
              <button className="min-h-10 rounded-xl bg-brand px-4 font-medium text-on-cor">Cadastrar</button>
            </form>
          </li>))}</ul>
      </section>}
    </div>)
}
