'use client'
import { useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { desfazerRestauracao } from '@/lib/backup'
import { comprimirParaEnvio, LIMITE_PEDIDO_BYTES } from '@/lib/comprimir'
import { PALAVRA_DE_CONFIRMACAO, type LinhaComparacao } from '@/lib/engine/restauracao'
import { inputCls } from '@/components/ui'
import { useAvisos } from '@/components/Avisos'

type Previa = { exportadoEm: string | null; conta: string | null; linhas: LinhaComparacao[]; avisos: string[]; concluidos: { backup: number; atual: number } }
type Resultado = { restauradas: Record<string, number>; descartadas: Record<string, number> }
const quando = (iso: string) => new Date(iso).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo', dateStyle: 'short', timeStyle: 'short' })
const MUDANCA: Record<LinhaComparacao['mudanca'], string> = { igual: '', menos: 'text-warn', mais: 'text-brand', fica: 'text-muted' }

/**
 * Restaurar um backup (substitui os dados atuais). Etapas: escolher o arquivo → conferir o que muda → confirmar digitando a palavra → restaurar.
 * Antes de trocar, o servidor guarda uma cópia do estado atual; "Desfazer" a devolve.
 */
export default function RestaurarBackup({ disponivel, desfazerEm }: { disponivel: boolean; desfazerEm: string | null }) {
  const router = useRouter(), entrada = useRef<HTMLInputElement>(null)
  const [arquivo, setArquivo] = useState<File | null>(null), [previa, setPrevia] = useState<Previa | null>(null), [erro, setErro] = useState<string | null>(null)
  const [entendi, setEntendi] = useState(false), [palavra, setPalavra] = useState(''), [resultado, setResultado] = useState<Resultado | null>(null)
  const [temCopia, setTemCopia] = useState(desfazerEm), [pend, start] = useTransition(), { mostrar } = useAvisos()
  const reiniciar = () => { setArquivo(null); setPrevia(null); setErro(null); setEntendi(false); setPalavra(''); if (entrada.current) entrada.current.value = '' }

  if (!disponivel) return <p className="text-sm text-muted">Para usar a restauração, é preciso aplicar a atualização do banco de dados (SQL <code>0026_restaurar_backup</code>) no Supabase.</p>

  const enviar = async (modo: 'previa' | 'restaurar') => {
    if (!arquivo) return null
    const blob = await comprimirParaEnvio(arquivo)
    if (blob.size > LIMITE_PEDIDO_BYTES) { setErro('O arquivo é grande demais para enviar por aqui. Tente de novo em um navegador atualizado (Chrome ou Safari recentes).'); return null }
    const f = new FormData(); f.set('modo', modo); f.set('arquivo', blob, arquivo.name); if (modo === 'restaurar') f.set('confirmacao', palavra)
    try {
      const r = await fetch('/api/backup/restaurar', { method: 'POST', body: f }), j = await r.json().catch(() => ({}))
      if (!r.ok) { setErro(j.erro ?? 'Não foi possível concluir. Tente de novo.'); return null }
      return j
    } catch { setErro('Sem conexão com o servidor. Verifique a internet e tente de novo.'); return null }
  }
  const verificar = () => start(async () => { setErro(null); setPrevia(null); const j = await enviar('previa'); if (j?.previa) setPrevia(j.previa) })
  const restaurar = () => start(async () => {
    setErro(null); const j = await enviar('restaurar')
    if (j?.ok) { setResultado({ restauradas: j.restauradas, descartadas: j.descartadas ?? {} }); setTemCopia(new Date().toISOString()); reiniciar(); router.refresh() }
  })
  const desfazer = () => { if (!window.confirm('Voltar ao estado de antes da última restauração? O que você restaurou será substituído por essa cópia.')) return
    start(async () => { const r = await desfazerRestauracao(); if (r.ok) { setTemCopia(null); setResultado(null); mostrar({ tipo: 'ok', conteudo: 'Restauração desfeita: seus dados voltaram ao estado anterior.' }); router.refresh() } else mostrar({ tipo: 'erro', conteudo: r.erro ?? 'Não foi possível desfazer.' }) }) }

  const confirmado = entendi && palavra.trim().toUpperCase() === PALAVRA_DE_CONFIRMACAO
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-sm text-muted">Escolha um arquivo de backup (.json) baixado do Residência OS. Antes de qualquer mudança você verá o que vai ser trocado.</p>
        <div className="flex flex-wrap items-center gap-2">
          <input ref={entrada} type="file" accept=".json,.gz,application/json,application/gzip" aria-label="Arquivo de backup" className="max-w-full text-sm file:mr-3 file:rounded-xl file:border file:border-line file:bg-transparent file:px-4 file:py-2 file:text-sm"
            onChange={e => { setArquivo(e.target.files?.[0] ?? null); setPrevia(null); setErro(null); setResultado(null); setEntendi(false); setPalavra('') }} />
          <button type="button" onClick={verificar} disabled={!arquivo || pend} className="rounded-xl border border-brand px-4 py-2 text-sm text-brand disabled:opacity-50">{pend && !previa ? 'Verificando…' : 'Verificar arquivo'}</button>
        </div>
      </div>

      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}

      {previa && (
        <div className="space-y-3 rounded-xl border border-line p-4">
          <p className="text-sm font-medium">Arquivo conferido{previa.exportadoEm ? ` · backup de ${quando(previa.exportadoEm)}` : ''}{previa.conta ? ` · conta ${previa.conta}` : ''}</p>
          {previa.avisos.map(a => <p key={a} role="status" className="rounded-lg bg-warn/10 p-2 text-sm">{a}</p>)}
          <div className="overflow-x-auto"><table className="w-full text-sm">
            <thead><tr className="text-left text-muted"><th className="py-1 pr-3 font-normal">Parte</th><th className="px-3 font-normal">No backup</th><th className="px-3 font-normal">Hoje</th></tr></thead>
            <tbody>{previa.linhas.map(l => (
              <tr key={l.tabela} className="border-t border-line"><td className="py-1.5 pr-3">{l.rotulo}</td>
                <td className={`px-3 ${MUDANCA[l.mudanca]}`}>{l.backup === null ? 'não tem' : l.backup}</td><td className="px-3 text-muted">{l.atual}{l.mudanca === 'fica' ? ' (fica como está)' : ''}</td></tr>))}</tbody>
          </table></div>
          <div className="space-y-3 border-t border-line pt-3">
            <p className="text-sm"><b>Restaurar substitui</b> os seus dados atuais pelos do arquivo. Antes, o app guarda uma cópia do estado de hoje, e você poderá desfazer.</p>
            <label className="flex items-start gap-2 text-sm"><input type="checkbox" checked={entendi} onChange={e => setEntendi(e.target.checked)} className="mt-1 accent-brand" />Entendi que isso substitui os dados que tenho agora.</label>
            <label className="block space-y-1 text-sm">Para confirmar, digite {PALAVRA_DE_CONFIRMACAO}
              <input value={palavra} onChange={e => setPalavra(e.target.value)} autoComplete="off" aria-label="Palavra de confirmação" className={inputCls + ' w-full max-w-xs'} /></label>
            <div className="flex gap-2"><button type="button" onClick={restaurar} disabled={!confirmado || pend} className="rounded-xl bg-brand px-4 py-2 text-sm font-medium text-black disabled:opacity-50">{pend ? 'Restaurando…' : 'Restaurar agora'}</button>
              <button type="button" onClick={reiniciar} disabled={pend} className="rounded-xl border border-line px-4 py-2 text-sm">Cancelar</button></div>
          </div>
        </div>)}

      {resultado && (
        <div role="status" className="space-y-1 rounded-xl border border-brand/40 bg-brand/10 p-4 text-sm">
          <p className="font-medium">Restauração concluída.</p>
          <p className="text-muted">{Object.values(resultado.restauradas).reduce((s, n) => s + n, 0)} registros restaurados.</p>
          {Object.keys(resultado.descartadas).length > 0 && <p className="text-warn">{Object.values(resultado.descartadas).reduce((s, n) => s + n, 0)} registros do arquivo não puderam ser ligados aos seus assuntos e ficaram de fora.</p>}
        </div>)}

      {temCopia && (
        <div className="space-y-2 rounded-xl border border-line p-4">
          <p className="text-sm font-medium">Desfazer a última restauração</p>
          <p className="text-sm text-muted">Existe uma cópia do seu estado de antes, feita em {quando(temCopia)}.</p>
          <button type="button" onClick={desfazer} disabled={pend} className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand disabled:opacity-50">Desfazer restauração</button>
        </div>)}
    </div>
  )
}
