import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { ehAdmin } from '@/lib/banco-data'
import { salvarProvaGeral, tirarDaProva, excluirProvaGeral } from '@/lib/provas-geral'
import { numerosQueFaltam } from '@/lib/engine/provas-banco'
import { textoDosBlocos, faixas, type Bloco } from '@/lib/engine/provas'
import { inputCls } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'

/** Uma prova cadastrada: nome, banca, ano e total; as questões na ordem, os números que faltam; tirar questão; apagar o cadastro. */
export default async function ProvaAdmin({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const [{ id }, { ok, erro }] = await Promise.all([params, searchParams])
  const sb = await supabaseServer()
  if (!(await ehAdmin(sb))) redirect('/banco')
  const { data: p } = await sb.from('provas_geral').select('id,nome,banca,ano,total').eq('id', id).maybeSingle()
  if (!p) notFound()
  const { data: ligs } = await sb.from('prova_geral_questoes').select('numero,geral_id,banco_geral(blocos,gabarito,anulada,tema_id)').eq('prova_id', id).order('numero')
  const linhas = (ligs ?? []) as unknown as { numero: number; geral_id: string; banco_geral: { blocos: Bloco[]; gabarito: string | null; anulada: boolean } | null }[]
  // o link para editar: a questão do banco da administradora que é a cópia desta questão do banco geral
  const { data: minhas } = linhas.length ? await sb.from('banco_questoes').select('id,origem_geral').in('origem_geral', linhas.map(l => l.geral_id)) : { data: [] }
  const editar = new Map(((minhas ?? []) as { id: string; origem_geral: string }[]).map(q => [q.origem_geral, q.id]))
  const faltam = numerosQueFaltam(p.total, linhas.map(l => l.numero)), semGabarito = linhas.filter(l => l.banco_geral && !l.banco_geral.gabarito && !l.banco_geral.anulada).map(l => l.numero)
  const card = 'space-y-3 rounded-2xl border border-line bg-surface p-5 text-sm'
  return (
    <div className="space-y-6">
      {ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{ok}</AvisoDaUrl>}
      {erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{erro}</AvisoDaUrl>}
      <div className="space-y-1"><Link href="/admin/provas" className="text-sm text-muted hover:text-brand">← Provas</Link>
        <h1 className="text-2xl font-semibold">{p.nome}</h1>
        <p className="text-sm text-muted">{linhas.length} de {p.total} questões{faltam.length ? <span className="text-warn"> · faltam: {faixas(faltam)}</span> : <span className="text-brand"> · completa</span>}
          {semGabarito.length > 0 && <span className="text-warn"> · sem gabarito (ficam fora da prova): {faixas(semGabarito)}</span>}</p></div>

      <form action={salvarProvaGeral} className={`${card} grid gap-2 sm:grid-cols-[2fr_1fr_6rem_6rem_auto] sm:items-end`}>
        <input type="hidden" name="id" value={p.id} />
        <label className="text-muted">Nome<input name="nome" required defaultValue={p.nome} maxLength={120} className={inputCls + ' mt-1 w-full'} /></label>
        <label className="text-muted">Banca<input name="banca" required defaultValue={p.banca} maxLength={60} className={inputCls + ' mt-1 w-full'} /></label>
        <label className="text-muted">Ano<input name="ano" required inputMode="numeric" defaultValue={p.ano} className={inputCls + ' mt-1 w-full'} /></label>
        <label className="text-muted">Questões<input name="total" required inputMode="numeric" defaultValue={p.total} className={inputCls + ' mt-1 w-full'} /></label>
        <button className="min-h-10 rounded-xl bg-brand px-4 font-medium text-black">Salvar</button>
      </form>
      {faltam.length > 0 && <p className="text-sm text-muted">Para completar: importe de novo o arquivo da prova com o mesmo nome (marcando &quot;prova inteira&quot;); as questões que já estão no banco não duplicam, só entram na prova.</p>}

      <section className="space-y-2">
        <h2 className="font-medium">Questões</h2>
        <ul className="divide-y divide-line rounded-2xl border border-line bg-surface text-sm">{linhas.map(l => (
          <li key={l.numero} className="flex items-center gap-3 px-4 py-2">
            <b className="w-8 shrink-0 text-right">{l.numero}.</b>
            <span className="min-w-0 flex-1 truncate">{textoDosBlocos((l.banco_geral?.blocos ?? []).filter(b => b.tipo === 'texto')).slice(0, 140)}</span>
            <span className="w-5 shrink-0 font-mono">{l.banco_geral?.anulada ? 'X' : l.banco_geral?.gabarito ?? '·'}</span>
            {editar.get(l.geral_id) && <Link href={`/admin/questoes/${editar.get(l.geral_id)}`} className="text-brand underline">Editar</Link>}
            <form action={tirarDaProva}><input type="hidden" name="prova" value={p.id} /><input type="hidden" name="numero" value={l.numero} /><button className="text-xs text-muted underline hover:text-danger">Tirar</button></form>
          </li>))}</ul>
      </section>

      <details className="rounded-2xl border border-line p-4">
        <summary className="cursor-pointer text-sm text-danger">Apagar o cadastro desta prova…</summary>
        <form action={excluirProvaGeral} className="mt-3 space-y-2"><input type="hidden" name="id" value={p.id} />
          <p className="text-sm text-muted">A prova sai de Questões → Provas. As questões continuam no banco, e as provas que as contas já fizeram continuam em &quot;Suas provas&quot;.</p>
          <button className="rounded-xl border border-danger px-4 py-2 text-sm text-danger hover:bg-danger/10">Apagar o cadastro</button></form>
      </details>
    </div>)
}
