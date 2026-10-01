import Link from 'next/link'
import { CONQUISTAS } from '@/lib/engine/gamificacao'
import { dispensarConquistas } from '@/lib/conquistas'

/** Banner discreto no topo de qualquer página; some quando o usuário clica em "Entendi". */
export function NovasConquistas({ codigos }: { codigos: string[] }) {
  const itens = codigos.map(c => CONQUISTAS.find(x => x.codigo === c)).filter((x): x is (typeof CONQUISTAS)[number] => !!x)
  if (!itens.length) return null
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand/10 p-4">
      <div className="text-sm">
        <p className="font-medium">🏅 {itens.length === 1 ? 'Nova conquista' : `${itens.length} novas conquistas`}</p>
        <p className="text-muted">{itens.slice(0, 3).map(i => i.titulo).join(', ')}{itens.length > 3 ? ` e mais ${itens.length - 3}` : ''} · <Link href="/metas" className="text-brand underline">ver conquistas</Link></p>
      </div>
      <form action={dispensarConquistas}><button className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand">Entendi</button></form>
    </div>
  )
}
