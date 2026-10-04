import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { ehAdmin } from '@/lib/banco-data'
import { responderMensagem, limparErros } from '@/lib/contato'
import { inputCls, fmtData } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'
import { TIPOS_MENSAGEM, type TipoMensagem } from '@/lib/engine/legal'
import { agruparErros, type ErroApp } from '@/lib/engine/erros'
import { provasPedidas, chaveDaProva } from '@/lib/engine/pedidos'

type Msg = { id: string; user_id: string; tipo: TipoMensagem; texto: string; banca?: string | null; ano?: number | null; anexo?: string | null; pagina: string | null; navegador: string | null; criada_em: string; resposta: string | null; resolvida_em: string | null }
const quando = (iso: string) => `${fmtData(iso.slice(0, 10))} ${new Date(iso).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Sao_Paulo' })}`

/** Administração → Mensagens: sugestões e problemas enviados por quem usa, e os erros do site registrados automaticamente. */
export default async function Mensagens({ searchParams }: { searchParams: Promise<{ ok?: string; erro?: string; ver?: string }> }) {
  const { ok, erro, ver } = await searchParams
  const sb = await supabaseServer()
  if (!(await ehAdmin(sb))) redirect('/banco')
  const todas = ver === 'todas'
  let q = sb.from('mensagens').select('*').order('criada_em', { ascending: false }).limit(100)
  if (!todas) q = q.is('resolvida_em', null)
  const [{ data: ms, error: eMs }, { data: es }] = await Promise.all([
    q, sb.from('erros_app').select('criado_em,origem,mensagem,digest,pagina,detalhe,navegador,user_id').order('criado_em', { ascending: false }).limit(500),
  ])
  const msgs = (ms ?? []) as Msg[], grupos = agruparErros((es ?? []) as ErroApp[])
  const abertos = msgs.filter(m => m.tipo === 'prova' && !m.resolvida_em), pedidas = provasPedidas(abertos.map(m => ({ id: m.id, banca: m.banca ?? null, ano: m.ano ?? null, anexo: m.anexo, criada_em: m.criada_em })))
  const iguais = new Map(pedidas.map(p => [p.chave, p.pedidos]))
  const anexos = msgs.map(m => m.anexo).filter((x): x is string => !!x)
  const { data: urls } = anexos.length ? await sb.storage.from('importacao').createSignedUrls(anexos, 3600) : { data: [] }
  const urlDe = new Map((urls ?? []).filter(u => u.signedUrl).map(u => [u.path, u.signedUrl]))
  return (
    <div className="space-y-6">
      {ok && <AvisoDaUrl tipo="ok" chaves={['ok']}>{ok}</AvisoDaUrl>}
      {erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{erro}</AvisoDaUrl>}
      <div><h1 className="text-2xl font-semibold">Mensagens</h1>
        <p className="text-sm text-muted">O que chegou por Ajustes → Sugestões e os erros que o site registrou sozinho.</p></div>
      {eMs && <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">Rode <code>supabase/migrations/0046_mensagens_erros.sql</code> no SQL Editor do Supabase para ativar esta página.</p>}

      {pedidas.length > 0 && <section className="space-y-2 rounded-2xl border border-line bg-surface p-4 text-sm">
        <h2 className="font-medium">Provas pedidas ({pedidas.length})</h2>
        <p className="text-xs text-muted">Em aberto, da mais pedida para a menos. Prepare com a skill, importe, publique e responda os pedidos abaixo (ao resolver, o PDF anexado é apagado).</p>
        <ul className="divide-y divide-line">{pedidas.map(p => (
          <li key={p.chave} className="flex flex-wrap items-baseline gap-x-3 py-1.5"><b className="font-medium">{p.banca}{p.ano ? ` ${p.ano}` : ''}</b>
            <span className="text-muted">{p.pedidos} pedido{p.pedidos > 1 ? 's' : ''}{p.comPdf ? ` · ${p.comPdf} com PDF` : ' · sem PDF'}</span></li>))}</ul>
      </section>}

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">{todas ? 'Todas as mensagens' : 'Mensagens em aberto'} ({msgs.length})</h2>
          <a href={todas ? '/admin/mensagens' : '/admin/mensagens?ver=todas'} className="text-sm text-brand underline">{todas ? 'Só as em aberto' : 'Ver também as resolvidas'}</a>
        </div>
        {!msgs.length && !eMs && <p className="text-sm text-muted">Nenhuma mensagem {todas ? 'ainda' : 'em aberto'}.</p>}
        <ul className="space-y-3">{msgs.map(m => (
          <li key={m.id} className={`space-y-3 rounded-2xl border bg-surface p-4 text-sm ${m.resolvida_em ? 'border-line opacity-70' : m.tipo === 'problema' ? 'border-danger/40' : 'border-line'}`}>
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted">
              <span className="rounded-full border border-line px-2 py-0.5">{TIPOS_MENSAGEM[m.tipo] ?? m.tipo}</span>
              {m.tipo === 'prova' && m.banca && <b className="font-medium text-inherit">{m.banca}{m.ano ? ` ${m.ano}` : ''}</b>}
              {m.tipo === 'prova' && m.banca && !m.resolvida_em && (iguais.get(chaveDaProva(m.banca, m.ano ?? null)) ?? 0) > 1 && <span className="text-warn">{iguais.get(chaveDaProva(m.banca, m.ano ?? null))} pedidos iguais</span>}
              <span>{quando(m.criada_em)}</span><span title={m.user_id}>conta {m.user_id.slice(0, 8)}</span>
              {m.pagina && <span>em <code>{m.pagina}</code></span>}
              {m.resolvida_em && <span className="text-brand">Resolvida</span>}
            </p>
            <p className="whitespace-pre-wrap">{m.texto}</p>
            {m.anexo && (urlDe.get(m.anexo) ? <a href={urlDe.get(m.anexo) ?? undefined} target="_blank" rel="noreferrer" className="inline-block rounded-lg border border-line px-3 py-1.5 hover:border-brand">Baixar o PDF</a>
              : <p className="text-xs text-warn">PDF anexado, mas não consegui o link (rode a 0047 para a administração poder baixar).</p>)}
            {m.navegador && <p className="truncate text-xs text-muted" title={m.navegador}>{m.navegador}</p>}
            {m.resolvida_em
              ? <form action={responderMensagem} className="flex flex-wrap items-center gap-2">
                  {m.resposta && <p className="w-full whitespace-pre-wrap rounded-xl border border-brand/40 bg-brand/10 p-3">{m.resposta}</p>}
                  <input type="hidden" name="id" value={m.id} /><input type="hidden" name="acao" value="reabrir" />
                  <button className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Reabrir</button></form>
              : <form action={responderMensagem} className="space-y-2">
                  <input type="hidden" name="id" value={m.id} /><input type="hidden" name="acao" value="resolver" />
                  <label className="block space-y-1"><span className="text-xs text-muted">Resposta (opcional — aparece para a pessoa em Ajustes → Sugestões)</span>
                    <textarea name="resposta" rows={2} maxLength={4000} defaultValue={m.resposta ?? ''} className={`${inputCls} w-full`}
                      placeholder={m.tipo === 'prova' ? 'Ex.: Já está no banco! Procure por banca e ano em Questões → Banco.' : undefined} /></label>
                  <button className="rounded-lg bg-brand px-3 py-1.5 font-medium text-black">Responder e marcar como resolvida{m.anexo ? ' (apaga o PDF)' : ''}</button>
                </form>}
          </li>))}</ul>
      </section>

      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Erros do site ({grupos.reduce((s, g) => s + g.vezes, 0)})</h2>
          {grupos.length > 0 && <form action={limparErros}><button className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-danger">Apagar todos</button></form>}
        </div>
        <p className="text-xs text-muted">Registrados sozinhos quando aparece a tela &quot;Algo deu errado&quot; (navegador) ou quando uma página falha no servidor. Agrupados pela mensagem; os mais recentes primeiro.</p>
        {!grupos.length && <p className="text-sm text-muted">Nenhum erro registrado.</p>}
        <ul className="space-y-2">{grupos.map(g => (
          <li key={g.mensagem} className="space-y-1 rounded-2xl border border-line bg-surface p-4 text-sm">
            <p className="flex flex-wrap items-center gap-2 text-xs text-muted"><b className="text-danger">{g.vezes}×</b><span>último {quando(g.ultimo)}</span>
              <span>{g.origens.join(' e ')}</span>{g.contas > 0 && <span>{g.contas} conta{g.contas > 1 ? 's' : ''}</span>}</p>
            <p className="break-words font-mono text-xs">{g.mensagem}</p>
            {g.paginas.length > 0 && <p className="text-xs text-muted">Páginas: {g.paginas.map(p => <code key={p} className="mr-2">{p}</code>)}</p>}
            {g.detalhe && <details className="text-xs"><summary className="cursor-pointer text-muted">Detalhe</summary><pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded-lg bg-bg p-2">{g.detalhe}</pre></details>}
            <form action={limparErros}><input type="hidden" name="mensagem" value={g.mensagem} /><button className="text-xs text-muted underline hover:text-danger">Apagar este</button></form>
          </li>))}</ul>
      </section>
    </div>)
}
