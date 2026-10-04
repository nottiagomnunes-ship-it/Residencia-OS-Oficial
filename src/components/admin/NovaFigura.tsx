'use client'
import { useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'

type Nova = { caminho: string; url: string; depoisDe: number }
const TIPOS: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/gif': 'gif', 'image/webp': 'webp' }

/**
 * Acrescentar figuras a uma questão (dentro do formulário de edição): escolher um arquivo ou colar um print (Ctrl+V).
 * A figura já sobe para o armazenamento ao escolher, mas só entra na questão ao clicar em Salvar (vai como "figura_nova" = "posição|caminho").
 * `trechos`: onde a figura pode entrar (depois de qual bloco do enunciado; -1 = no começo).
 */
export default function NovaFigura({ trechos }: { trechos: { indice: number; rotulo: string }[] }) {
  const [novas, setNovas] = useState<Nova[]>([]), [erro, setErro] = useState<string | null>(null), [enviando, setEnviando] = useState(false)
  const fim = trechos.length ? trechos[trechos.length - 1].indice : -1

  async function enviar(f: File | Blob | null | undefined) {
    setErro(null)
    if (!f) return
    const ext = TIPOS[f.type]
    if (!ext) { setErro('Use uma imagem PNG, JPEG, GIF ou WebP.'); return }
    if (f.size > 5 * 1024 * 1024) { setErro('A imagem passa de 5 MB. Diminua antes de enviar.'); return }
    setEnviando(true)
    try {
      const sb = supabaseBrowser()
      const { data: { user } } = await sb.auth.getUser()
      if (!user) throw new Error('Sua sessão expirou. Entre de novo.')
      const caminho = `${user.id}/banco/${crypto.randomUUID()}.${ext}`
      const { error } = await sb.storage.from('provas').upload(caminho, f, { contentType: f.type, upsert: false })
      if (error) throw new Error('Não foi possível enviar a imagem. Confira a internet e tente de novo.')
      setNovas(n => [...n, { caminho, url: URL.createObjectURL(f), depoisDe: fim }])
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível enviar a imagem.') } finally { setEnviando(false) }
  }

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-line p-3 text-sm"
      onPaste={e => { const it = Array.from(e.clipboardData.items).find(i => i.type.startsWith('image/')); if (it) { e.preventDefault(); enviar(it.getAsFile()) } }}>
      {novas.map((n, k) => (
        <div key={n.caminho} className="flex flex-wrap items-start gap-3 rounded-lg border border-brand/40 p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={n.url} alt={`Figura nova ${k + 1}`} className="max-h-40 rounded" />
          <div className="flex-1 space-y-2">
            <input type="hidden" name="figura_nova" value={`${n.depoisDe}|${n.caminho}`} />
            <label className="block text-muted">Onde entra
              <select value={n.depoisDe} onChange={e => setNovas(v => v.map((x, i) => (i === k ? { ...x, depoisDe: Number(e.target.value) } : x)))} className="mt-1 block w-full rounded-lg border border-line bg-bg px-2 py-1.5">
                <option value={-1}>No começo do enunciado</option>
                {trechos.map(t => <option key={t.indice} value={t.indice}>{t.rotulo}</option>)}
              </select></label>
            <button type="button" onClick={() => setNovas(v => v.filter((_, i) => i !== k))} className="text-danger hover:underline">Não acrescentar</button>
          </div>
        </div>))}
      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-line px-3 py-1.5 hover:border-brand">{enviando ? 'Enviando…' : 'Acrescentar figura'}
          <input type="file" accept="image/png,image/jpeg,image/gif,image/webp" className="sr-only" disabled={enviando} onChange={e => { enviar(e.target.files?.[0]); e.target.value = '' }} /></label>
        <span className="text-muted">ou clique aqui e cole um print (Ctrl+V).</span>
      </div>
      {novas.length > 0 && <p className="text-xs text-brand">A figura entra na questão quando você clicar em Salvar.</p>}
      {erro && <p role="alert" className="text-danger">{erro}</p>}
    </div>)
}
