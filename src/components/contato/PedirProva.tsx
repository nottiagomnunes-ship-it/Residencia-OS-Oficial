'use client'
import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
import { pedirProva } from '@/lib/contato'
import { inputCls } from '@/components/ui'

const MAX_PDF = 30 * 1024 * 1024

/**
 * Pedir uma prova para o banco geral: banca, ano, observação e, se tiver, o PDF (vai direto do navegador para o armazenamento
 * "importacao", na pasta da pessoa; o servidor só recebe o caminho). Se o banco já tem questões dessa banca e ano, pergunta antes.
 */
export default function PedirProva({ banca: b0 = '', ano: a0 = '' }: { banca?: string; ano?: string }) {
  const router = useRouter()
  const [banca, setBanca] = useState(b0), [ano, setAno] = useState(a0), [texto, setTexto] = useState(''), [pdf, setPdf] = useState<File | null>(null)
  const [enviando, setEnviando] = useState(false), [erro, setErro] = useState<string | null>(null), [jaTem, setJaTem] = useState<number | null>(null)
  const [anexo, setAnexo] = useState<string | null>(null) // PDF já enviado (para não mandar de novo ao confirmar)

  async function enviar(confirmado = false) {
    setErro(null); setEnviando(true)
    let caminho = anexo
    try {
      if (pdf && !caminho) {
        if (pdf.size > MAX_PDF) throw new Error('O PDF passa de 30 MB. Envie sem o PDF e explique na observação onde achar a prova.')
        if (!/\.pdf$/i.test(pdf.name) && pdf.type !== 'application/pdf') throw new Error('O arquivo precisa ser um PDF.')
        const sb = supabaseBrowser(), { data: { user } } = await sb.auth.getUser()
        if (!user) throw new Error('Sua sessão expirou. Entre de novo.')
        caminho = `${user.id}/pedidos/${crypto.randomUUID()}.pdf`
        const { error } = await sb.storage.from('importacao').upload(caminho, pdf, { contentType: 'application/pdf', upsert: false })
        if (error) throw new Error(/bucket|not found/i.test(error.message) ? 'O envio de PDF ainda não está ativo. Envie sem o PDF.' : 'Não consegui enviar o PDF. Confira a internet e tente de novo.')
        setAnexo(caminho)
      }
      const r = await pedirProva({ banca, ano, texto, anexo: caminho, confirmado })
      if (r.ok) { router.push(`/contato?ok=${encodeURIComponent('Pedido enviado. Quando a prova entrar no banco, a resposta aparece aqui.')}`); router.refresh(); return }
      if ('jaTem' in r) setJaTem(r.jaTem)
      else setErro(r.erro)
    } catch (e) { setErro(e instanceof Error ? e.message : 'Não foi possível enviar.') }
    setEnviando(false)
  }

  const busca = `/banco/questoes?${new URLSearchParams({ banca: banca.trim(), ...(ano ? { de: ano, ate: ano } : {}) }).toString()}`
  return (
    <form id="pedir-prova" onSubmit={e => { e.preventDefault(); enviar(false) }} className="space-y-4 rounded-2xl border border-line bg-surface p-5">
      <div className="space-y-1"><h2 className="font-medium">Pedir uma prova para o banco</h2>
        <p className="text-sm text-muted">Não achou uma prova no Banco? Peça aqui. A administração prepara a prova (tema, gabarito, explicações e figuras) e publica para todo mundo.</p></div>
      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <label className="block space-y-1"><span className="text-sm">Banca</span>
          <input value={banca} onChange={e => { setBanca(e.target.value); setJaTem(null) }} required minLength={2} maxLength={80} placeholder="Ex.: USP-SP, UNIFESP, ENARE" className={`${inputCls} w-full`} /></label>
        <label className="block space-y-1"><span className="text-sm">Ano</span>
          <input value={ano} onChange={e => { setAno(e.target.value.replace(/\D/g, '').slice(0, 4)); setJaTem(null) }} inputMode="numeric" placeholder="2025" className={`${inputCls} w-full`} /></label>
      </div>
      <label className="block space-y-1"><span className="text-sm">PDF da prova (opcional, até 30 MB)</span>
        <input type="file" accept="application/pdf,.pdf" onChange={e => { setPdf(e.target.files?.[0] ?? null); setAnexo(null) }} className="block w-full text-sm" />
        <span className="block text-xs text-muted">Com o gabarito, se tiver. Sem PDF, a administração procura a prova.</span></label>
      <label className="block space-y-1"><span className="text-sm">Observação (opcional)</span>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={2} maxLength={4000} placeholder="Ex.: só a prova de acesso direto; o gabarito saiu no site da banca." className={`${inputCls} w-full`} /></label>
      {erro && <p role="alert" className="text-sm text-danger">{erro}</p>}
      {jaTem !== null
        ? <div role="status" className="space-y-2 rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm">
            <p>O banco já tem {jaTem} {jaTem === 1 ? 'questão' : 'questões'} de {banca.trim()}{ano ? ` ${ano}` : ''}. Confira antes: pode ser a prova que você quer.</p>
            <div className="flex flex-wrap gap-2">
              <Link href={busca} className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Ver no Banco</Link>
              <button type="button" disabled={enviando} onClick={() => enviar(true)} className="rounded-lg bg-brand px-3 py-1.5 font-medium text-on-cor disabled:opacity-60">{enviando ? 'Enviando…' : 'Falta prova ou questões: pedir mesmo assim'}</button>
            </div>
          </div>
        : <button disabled={enviando} className="rounded-xl bg-brand px-4 py-2 font-medium text-on-cor disabled:opacity-60">{enviando ? 'Enviando…' : 'Pedir a prova'}</button>}
    </form>)
}
