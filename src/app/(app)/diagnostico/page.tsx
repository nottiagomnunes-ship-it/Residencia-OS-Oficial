import Link from 'next/link'
import { avaliarVariavel } from '@/lib/engine/diagnostico'

const COR = { ok: 'text-brand', ausente: 'text-danger', atencao: 'text-warn' } as const
const ROTULO = { ok: 'OK', ausente: 'Ausente', atencao: 'Atenção' } as const

/** Mostra o que o servidor enxerga (sem revelar valores): ajuda a achar variável faltando ou publicação antiga. */
export default function Diagnostico() {
  const e = process.env
  const variaveis = ['RESEND_API_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET', 'EMAIL_FROM'].map(n => avaliarVariavel(n, e[n]))
  let host = '(não definido)'
  try { host = new URL(e.NEXT_PUBLIC_SUPABASE_URL ?? '').host } catch {}
  const info: [string, string][] = [
    ['Ambiente da publicação', e.VERCEL_ENV ?? '(fora da Vercel)'], ['Commit no ar', e.VERCEL_GIT_COMMIT_SHA ? e.VERCEL_GIT_COMMIT_SHA.slice(0, 7) : '(não informado)'],
    ['Mensagem do commit', e.VERCEL_GIT_COMMIT_MESSAGE ?? '(não informada)'], ['Endereço desta publicação', e.VERCEL_URL ?? '(não informado)'],
    ['Endereço principal do projeto', e.VERCEL_PROJECT_PRODUCTION_URL ?? '(não informado)'], ['Supabase conectado', host],
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
    </div>
  )
}
