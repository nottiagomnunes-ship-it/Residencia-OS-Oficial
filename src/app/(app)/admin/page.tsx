import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { ehAdmin, aplicarFiltroAdmin, sincronizarBancoGeral, type FiltroAdmin } from '@/lib/banco-data'
import { textoDosBlocos, type Bloco } from '@/lib/engine/provas'
import { fmtData } from '@/components/ui'

const PENDENCIAS: { adm: FiltroAdmin; titulo: string; dica: string }[] = [
  { adm: 'falta-publicar', titulo: 'Alteradas, falta publicar', dica: 'Você mudou depois de publicar: as outras contas ainda veem a versão antiga.' },
  { adm: 'sem-tema', titulo: 'Sem tema', dica: 'Sem tema, as outras contas não acham a questão ao buscar por assunto.' },
  { adm: 'sem-explicacao', titulo: 'Sem explicação', dica: 'Com gabarito e sem explicação.' },
  { adm: 'so-meu', titulo: 'Só no seu banco', dica: 'Ainda não publicadas no banco geral.' },
]

/** Administração → Pendências: o que falta fazer nas questões, com um atalho para cada coisa. */
export default async function Pendencias() {
  const sb = await supabaseServer()
  if (!(await ehAdmin(sb))) redirect('/banco')
  await sincronizarBancoGeral(sb)
  const contar = (adm: FiltroAdmin) => aplicarFiltroAdmin(sb.from('banco_questoes').select('id', { count: 'exact', head: true }), adm)
  const [{ count: total }, { data: reportes, error: eRep }, ...cs] = await Promise.all([
    sb.from('banco_questoes').select('id', { count: 'exact', head: true }),
    sb.from('explicacao_reportes').select('id,hash,motivo,criado_em').is('resolvido_em', null).order('criado_em').limit(50),
    ...PENDENCIAS.map(p => contar(p.adm)),
  ])
  const abertos = (reportes ?? []) as { id: string; hash: string; motivo: string; criado_em: string }[]
  const { data: dosReportes } = abertos.length
    ? await sb.from('banco_questoes').select('id,hash,blocos,banca,ano').in('hash', [...new Set(abertos.map(r => r.hash))])
    : { data: [] }
  const porHash = new Map(((dosReportes ?? []) as { id: string; hash: string; blocos: Bloco[]; banca: string | null; ano: number | null }[]).map(q => [q.hash, q]))
  const n = PENDENCIAS.map((p, k) => ({ ...p, n: cs[k].error ? null : cs[k].count ?? 0 }))
  const faltaMigracao = !!eRep || n.some(p => p.n === null)
  const nada = !abertos.length && n.every(p => !p.n || p.adm === 'so-meu')
  return (
    <div className="space-y-6">
      <div><h1 className="text-2xl font-semibold">Pendências</h1>
        <p className="text-sm text-muted">O que falta fazer nas questões do banco ({total ?? 0} no total). Clique para ver só aquelas.</p></div>
      {faltaMigracao && <p className="rounded-xl border border-warn/40 bg-warn/10 p-3 text-sm text-warn">Algumas contagens precisam das migrations novas: rode <code>supabase/migrations/0043_admin_pendencias.sql</code> (depois da 0040 e da 0042) no SQL Editor do Supabase.</p>}

      {abertos.length > 0 && <section className="space-y-3 rounded-2xl border border-danger/40 bg-surface p-5 text-sm">
        <h2 className="font-medium text-danger">Explicações reportadas ({abertos.length})</h2>
        <ul className="divide-y divide-line">{abertos.map(r => { const q = porHash.get(r.hash); return (
          <li key={r.id} className="flex flex-wrap items-center gap-2 py-2">
            <span className="min-w-0 flex-1"><b className="font-medium">“{r.motivo}”</b> <span className="text-xs text-muted">· {fmtData(r.criado_em.slice(0, 10))}</span>
              {q && <span className="block truncate text-xs text-muted">{[q.banca, q.ano].filter(Boolean).join(' ')} · {textoDosBlocos(q.blocos ?? []).slice(0, 140)}</span>}</span>
            {q ? <Link href={`/admin/questoes/${q.id}?lista=${encodeURIComponent('/admin/questoes?adm=reportadas')}`} className="rounded-lg border border-line px-3 py-1.5 hover:border-brand">Abrir e corrigir</Link>
              : <span className="text-xs text-warn">Não está mais no seu banco</span>}
          </li>) })}</ul>
      </section>}

      <ul className="grid gap-3 sm:grid-cols-2">{n.map(p => (
        <li key={p.adm}><Link href={`/admin/questoes?adm=${p.adm}`} className="block h-full space-y-1 rounded-2xl border border-line bg-surface p-4 hover:border-brand">
          <span className="flex items-baseline justify-between gap-2"><span className="font-medium">{p.titulo}</span>
            <span className={`text-2xl font-semibold ${p.n ? (p.adm === 'so-meu' ? '' : 'text-warn') : 'text-muted'}`}>{p.n ?? '—'}</span></span>
          <span className="block text-sm text-muted">{p.dica}</span>
        </Link></li>))}</ul>

      {nada && !faltaMigracao && <p role="status" className="rounded-xl border border-brand/40 bg-brand/10 p-3 text-sm">Tudo em dia: nenhuma questão alterada sem publicar, sem tema, sem explicação ou com reporte aberto.</p>}

      <div className="flex flex-wrap gap-2 text-sm">
        <Link href="/admin/questoes" className="rounded-xl border border-line px-4 py-2 hover:border-brand">Ver todas as questões</Link>
        <Link href="/admin/importar" className="rounded-xl border border-line px-4 py-2 hover:border-brand">Importar questões</Link>
        <Link href="/admin/temas" className="rounded-xl border border-line px-4 py-2 hover:border-brand">Lista de temas</Link>
      </div>
    </div>)
}
