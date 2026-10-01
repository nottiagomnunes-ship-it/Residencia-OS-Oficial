'use client'
import { useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { parseCronograma } from '@/lib/engine/importar'
import { lerPdf, importarCronograma, limparCatalogo } from '@/lib/importar'

const EXEMPLO = `# Clínica Médica
## Cardiologia
Hipertensão arterial
Insuficiência cardíaca - 05/10

# Pediatria
Bronquiolite
12/10 Doenças exantemáticas

Cirurgia > Trauma > Trauma torácico`

export default function Importador({ hoje, total }: { hoje: string; total: number }) {
  const [texto, setTexto] = useState(''), [substituir, setSubstituir] = useState(true)
  const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null)
  const [pend, start] = useTransition()
  const prev = useMemo(() => parseCronograma(texto, hoje), [texto, hoje])
  const porDisc = useMemo(() => { const m = new Map<string, number>(); prev.itens.forEach(i => m.set(i.disciplina, (m.get(i.disciplina) ?? 0) + 1)); return [...m] }, [prev])
  const comData = prev.itens.filter(i => i.data).length
  const grupos = useMemo(() => [...new Set(prev.itens.map(i => i.grupo).filter(Boolean))] as string[], [prev])

  function escolherPdf(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]; if (!f) return
    const fd = new FormData(); fd.set('pdf', f); e.target.value = ''
    start(async () => {
      const r = await lerPdf(fd)
      if (r.texto) { setTexto(r.texto); setMsg({ ok: true, t: 'PDF lido. Revise o texto abaixo: marque os títulos de disciplina com # e corrija o que precisar.' }) } else setMsg({ ok: false, t: r.erro ?? 'Erro ao ler o PDF.' })
    })
  }
  function importar() {
    if (substituir && !confirm('Isso remove os assuntos atuais que ainda não têm histórico (questões, revisões ou estudo). Continuar?')) return
    start(async () => { const r = await importarCronograma(texto, substituir); setMsg({ ok: r.ok, t: r.ok ? r.resumo! : r.erro! }); if (r.ok) setTexto('') })
  }
  function limpar() {
    if (!confirm('Remover todos os assuntos sem histórico? Isso não pode ser desfeito.')) return
    start(async () => { const r = await limparCatalogo(); setMsg({ ok: true, t: r.resumo }) })
  }
  const box = 'space-y-4 rounded-2xl border border-line bg-surface p-5'
  return (
    <div className="space-y-6">
      {msg && <p role={msg.ok ? 'status' : 'alert'} className={`rounded-xl border p-4 text-sm ${msg.ok ? 'border-brand/40 bg-brand/10' : 'border-danger/40 bg-danger/10 text-danger'}`}>{msg.t}
        {msg.ok && msg.t.includes('importados') && <> Agora <Link href="/cronograma" className="text-brand underline">gere o cronograma</Link> para distribuir os assuntos sem data.</>}</p>}
      <section className={box}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-medium">Seu cronograma em texto</h2>
          <label className="cursor-pointer rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Ler de um PDF<input type="file" accept="application/pdf" onChange={escolherPdf} className="sr-only" /></label>
        </div>
        <textarea value={texto} onChange={e => setTexto(e.target.value)} rows={12} aria-label="Cronograma em texto" placeholder={EXEMPLO}
          className="w-full rounded-xl border border-line bg-bg p-3 font-mono text-sm outline-none focus:border-brand" />
        <details className="text-sm"><summary className="cursor-pointer text-brand">Como escrever</summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-muted">
            <li><b># Disciplina</b> abre um grupo; <b>## Subcategoria</b> é opcional. Um assunto por linha logo abaixo.</li>
            <li><b># SEMANA 1</b> (ou Dia, Bloco, Etapa, Fase, Mês) define a <b>ordem de estudo</b>, não é uma disciplina. Dentro dela, use <b>## Disciplina</b> e os assuntos embaixo. Cada semana é de segunda a domingo, com os assuntos espaçados entre os dias livres, na ordem em que você escreveu. Se restarem menos de 3 dias úteis na semana atual, a Semana 1 começa na próxima segunda.</li>
            <li>Ou em uma linha só: <b>Disciplina &gt; Subcategoria &gt; Assunto</b>.</li>
            <li>Data opcional no começo ou no fim da linha (<b>05/10 Assunto</b>, <b>Assunto - 05/10</b>, <b>2026-10-05</b>). Assuntos com data ficam fixos no cronograma; os demais são distribuídos pelo gerador.</li>
            <li>Em PDFs, títulos TODOS EM MAIÚSCULAS ou terminados em “:” também viram disciplinas. Só funciona com PDF de texto, não com imagem escaneada.</li>
          </ul></details>
      </section>
      {texto.trim() && (
        <section className={box}>
          <h2 className="font-medium">Pré-visualização</h2>
          <p className="text-sm">{prev.itens.length} assuntos em {porDisc.length} disciplinas{comData ? ` · ${comData} com data` : ''}</p>
          {grupos.length > 0 && <p className="text-sm text-muted">Ordem de estudo: {grupos.join(' → ')}</p>}
          {porDisc.length > 0 && <ul className="grid gap-2 text-sm sm:grid-cols-2">{porDisc.map(([d, n]) => <li key={d} className="flex justify-between rounded-lg border border-line px-3 py-1.5"><span>{d}</span><span className="text-muted">{n}</span></li>)}</ul>}
          {prev.avisos.length > 0 && <ul className="list-disc space-y-1 pl-5 text-sm text-warn">{prev.avisos.slice(0, 6).map((a, i) => <li key={i}>{a}</li>)}{prev.avisos.length > 6 && <li>e mais {prev.avisos.length - 6} avisos</li>}</ul>}
          <label className="flex items-start gap-3 text-sm"><input type="checkbox" checked={substituir} onChange={e => setSubstituir(e.target.checked)} className="mt-1 accent-brand" />
            <span>Substituir os assuntos atuais<span className="block text-xs text-muted">Remove os que ainda não têm histórico ({total} assuntos hoje). Assuntos com questões, revisões ou estudo são mantidos.</span></span></label>
          <button onClick={importar} disabled={pend || !prev.itens.length} className="rounded-xl bg-brand px-5 py-2.5 font-medium text-black disabled:opacity-50">{pend ? 'Importando…' : `Importar ${prev.itens.length} assuntos`}</button>
        </section>)}
      <section className={box}>
        <h2 className="font-medium">Só limpar</h2>
        <p className="text-sm text-muted">Remove os assuntos sugeridos que você não começou, sem importar nada. Depois você pode adicionar os seus em <Link href="/conteudos" className="text-brand underline">Conteúdos</Link>.</p>
        <button onClick={limpar} disabled={pend} className="rounded-xl border border-line px-4 py-2 text-sm hover:border-danger hover:text-danger disabled:opacity-50">Remover assuntos sem histórico</button>
      </section>
    </div>
  )
}
