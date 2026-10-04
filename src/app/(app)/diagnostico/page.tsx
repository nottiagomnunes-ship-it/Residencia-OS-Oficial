import Link from 'next/link'
import { avaliarVariavel, avaliarLatencia, mediana } from '@/lib/engine/diagnostico'
import { supabaseServer } from '@/lib/supabase/server'

const COR = { ok: 'text-brand', ausente: 'text-danger', atencao: 'text-warn' } as const
const ROTULO = { ok: 'OK', ausente: 'Ausente', atencao: 'Atenção' } as const

/** Mostra o que o servidor enxerga (sem revelar valores): ajuda a achar variável faltando ou publicação antiga. */
/** Tempo de ida e volta de uma consulta mínima ao banco, a partir do servidor (5 vezes; a primeira "aquece" a conexão e não conta). */
async function medirBanco() {
  try {
    const sb = await supabaseServer(), tempos: number[] = []
    for (let i = 0; i < 5; i++) {
      const t = performance.now(); const { error } = await sb.from('profiles').select('id').limit(1); const d = performance.now() - t
      if (error) return null
      if (i > 0) tempos.push(d)
    }
    return mediana(tempos)
  } catch { return null }
}

export default async function Diagnostico() {
  const e = process.env
  const ms = await medirBanco(), lat = avaliarLatencia(ms)
  const variaveis = ['RESEND_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'EMAIL_FROM'].map(n => avaliarVariavel(n, e[n]))
  let host = '(não definido)'
  try { host = new URL(e.NEXT_PUBLIC_SUPABASE_URL ?? '').host } catch {}
  const info: [string, string][] = [
    ['Ambiente da publicação', e.VERCEL_ENV ?? '(fora da Vercel)'], ['Commit no ar', e.VERCEL_GIT_COMMIT_SHA ? e.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : '(não informado)'],
    ['Mensagem do commit', e.VERCEL_GIT_COMMIT_MESSAGE ?? '(não informada)'], ['Endereço desta publicação', e.VERCEL_URL ?? '(não informado)'],
    ['Endereço principal do projeto', e.VERCEL_PROJECT_PRODUCTION_URL ?? '(não informado)'], ['Supabase conectado', host],
    ['Região do servidor (Vercel)', e.VERCEL_REGION ?? '(fora da Vercel)'],
  ]
  return (
    <div className="max-w-3xl space-y-6">
      <div><Link href="/configuracoes" className="text-sm text-muted hover:text-brand">← Configurações</Link><h1 className="mt-1 text-2xl font-semibold">Diagnóstico do servidor</h1>
        <p className="text-muted">Mostra o que o servidor enxerga. Nenhum valor secreto é exibido.</p></div>
      <section className="space-y-2 rounded-2xl border border-line bg-surface p-5"><h2 className="font-medium">Variáveis de ambiente</h2>
        <ul className="space-y-2 text-sm">{variaveis.map(v => (
          <li key={v.nome} className="flex flex-wrap items-baseline gap-x-3"><code className="w-60">{v.nome}</code><b className={COR[v.estado]}>{ROTULO[v.estado]}</b><span className="text-muted">{v.detalhe}</span></li>))}</ul>
        <p className="text-xs text-muted">EMAIL_FROM é opcional. As outras três são necessárias para o lembrete por e-mail.</p></section>
      <section className="space-y-2 rounded-2xl border border-line bg-surface p-5"><h2 className="font-medium">Publicação no ar</h2>
        <dl className="space-y-1 text-sm">{info.map(([k, v]) => <div key={k} className="flex flex-wrap gap-x-3"><dt className="w-60 text-muted">{k}</dt><dd className="break-all">{v}</dd></div>)}</dl></section>
      <section className="space-y-2 rounded-2xl border border-line bg-surface p-5"><h2 className="font-medium">Velocidade até o banco</h2>
        <p className="text-sm"><span className="text-muted">Uma consulta (ida e volta): </span><b className={COR[lat.estado]}>{ms === null ? '—' : `${ms} ms`}</b> <span className="text-muted">· {lat.detalhe}</span></p>
        <p className="text-xs text-muted">Medido agora, do servidor até o Supabase (mediana de 4 medições). Até ~15 ms quer dizer que estão na mesma região. Recarregue a página para medir de novo.</p></section>
    </div>
  )
}
