import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { ehAdmin, carregarTemas } from '@/lib/banco-data'
import { adicionarTemas, editarTema, excluirTema } from '@/lib/banco'
import { porEspecialidade } from '@/lib/engine/temas'
import { AREAS, ROTULO_AREA, SIGLA_AREA } from '@/lib/engine/areas'
import { inputCls } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'

/**
 * Lista de temas (só a conta administradora): a etiqueta das questões do banco geral. Não mexe em Matérias nem no plano de ninguém;
 * serve para buscar, filtrar e praticar por tema (e, depois, ver o que cada banca mais cobra).
 */
export default async function Temas({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const sp = await searchParams
  const sb = await supabaseServer()
  if (!(await ehAdmin(sb))) redirect('/banco/questoes')
  const [temas, { data: usos, error }] = await Promise.all([carregarTemas(sb), sb.from('banco_questoes').select('tema_id').not('tema_id', 'is', null).limit(20000)])
  const n = new Map<string, number>()
  for (const u of (usos ?? []) as { tema_id: string }[]) n.set(u.tema_id, (n.get(u.tema_id) ?? 0) + 1)
  const grupos = porEspecialidade(temas), btn = 'rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand'
  return (
    <div className="space-y-6">
      <div className="space-y-1">
                <h1 className="text-2xl font-semibold">Lista de temas</h1>
        <p className="text-muted">A etiqueta das questões do banco geral (especialidade › tema). Serve para todo mundo buscar e praticar por tema; <b>não</b> mexe em Matérias nem no plano de ninguém, que continuam com os próprios assuntos.</p>
      </div>
      {sp.ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{sp.ok}</AvisoDaUrl>}
      {sp.erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{sp.erro}</AvisoDaUrl>}
      {error && <p className="rounded-2xl border border-warn/40 bg-warn/10 p-4 text-sm text-warn">Para usar a lista de temas, rode <code>supabase/migrations/0040_temas.sql</code> no SQL Editor do Supabase e recarregue a página.</p>}

      <form action={adicionarTemas} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <input type="hidden" name="volta" value="/admin/temas" />
        <h2 className="font-medium">Acrescentar temas</h2>
        <p className="text-sm text-muted">Cole um tema por linha. Pode ser "Especialidade &gt; Tema", "Área &gt; Especialidade &gt; Tema" ou um título com a lista embaixo. Depois de ":" vão as <b>palavras-chave</b>, separadas por vírgula: remédios, exames e achados que denunciam o tema no enunciado. São elas que fazem o "Sugerir tema pelo texto" funcionar. Os temas que já existem não se repetem, mas ganham as palavras-chave novas.</p>
        <textarea name="lista" rows={8} required className={inputCls + ' w-full font-mono text-sm'} placeholder={'Anestesiologia\n- Bloqueadores neuromusculares: rocurônio, succinilcolina, sugamadex, neostigmina\n- Hipertermia maligna: dantrolene, rigidez de masseter\n\nPediatria > Neonatologia > Icterícia neonatal: bilirrubina, fototerapia, kernicterus'} />
        <button className="rounded-xl bg-brand px-5 py-2 font-medium text-on-cor">Acrescentar</button>
      </form>

      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-medium">{temas.length} {temas.length === 1 ? 'tema' : 'temas'}{grupos.length ? ` em ${grupos.length} ${grupos.length === 1 ? 'especialidade' : 'especialidades'}` : ''}</h2>
          {temas.length > 0 && <a href="/admin/temas/lista" className={btn}>Baixar a lista (.txt) para o Claude</a>}
        </div>
        {!temas.length && <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Nenhum tema ainda. Cole a lista acima para começar.</p>}
        {grupos.map(([esp, ts]) => (
          <details key={esp} className="rounded-2xl border border-line bg-surface p-4" open={grupos.length <= 3}>
            <summary className="cursor-pointer font-medium">{esp} <span className="font-normal text-muted">· {ts.length} {ts.length === 1 ? 'tema' : 'temas'}{ts[0].area ? ` · ${SIGLA_AREA[ts[0].area]}` : ''}</span></summary>
            <ul className="mt-3 divide-y divide-line text-sm">{ts.map(t => (
              <li key={t.id} className="py-2">
                <details>
                  <summary className="flex cursor-pointer flex-wrap justify-between gap-2"><span>{t.nome}{t.palavras ? <span className="block text-xs text-muted">{t.palavras}</span> : <span className="block text-xs text-warn">sem palavras-chave</span>}</span><span className="text-muted">{n.get(t.id) ?? 0} {(n.get(t.id) ?? 0) === 1 ? 'questão' : 'questões'}</span></summary>
                  <div className="mt-2 flex flex-wrap items-end gap-2">
                    <form action={editarTema} className="flex flex-1 flex-wrap items-end gap-2">
                      <input type="hidden" name="id" value={t.id} /><input type="hidden" name="volta" value="/admin/temas" />
                      <label className="min-w-40 flex-1 text-muted">Tema<input name="nome" defaultValue={t.nome} maxLength={120} required className={inputCls + ' w-full'} /></label>
                      <label className="min-w-40 flex-1 text-muted">Especialidade<input name="especialidade" defaultValue={t.especialidade} maxLength={80} required className={inputCls + ' w-full'} /></label>
                      <label className="w-full text-muted">Palavras-chave (separadas por vírgula)<input name="palavras" defaultValue={t.palavras ?? ''} maxLength={500} placeholder="Ex.: rocurônio, succinilcolina, sugamadex" className={inputCls + ' w-full'} /></label>
                      <label className="text-muted">Área<select name="area" defaultValue={t.area ?? ''} className={inputCls + ' w-full'}><option value="">—</option>{AREAS.map(a => <option key={a} value={a}>{ROTULO_AREA[a]}</option>)}</select></label>
                      <button className={btn}>Salvar</button>
                    </form>
                    <form action={excluirTema}><input type="hidden" name="id" value={t.id} /><input type="hidden" name="volta" value="/admin/temas" />
                      <button className="px-2 py-1.5 text-sm text-danger hover:underline">Apagar</button></form>
                  </div>
                </details>
              </li>))}</ul>
          </details>))}
      </section>
    </div>)
}
