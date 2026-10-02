import { dispensarPromocoes } from '@/lib/promocoes'

/** Banner de promoção (subiu de rank ou ganhou um título novo); some ao tocar em "Entendi". */
export function NovasPromocoes({ rank, titulo }: { rank: string | null; titulo: string | null }) {
  if (!rank && !titulo) return null
  return (
    <div role="status" className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-brand/40 bg-brand/10 p-4">
      <div className="space-y-0.5 text-sm">
        {rank && <p className="font-medium">🏆 Você subiu de rank: <span className="text-brand">{rank}</span></p>}
        {titulo && <p className="font-medium">🎖️ Novo título: <span className="text-brand">{titulo}</span></p>}
      </div>
      <form action={dispensarPromocoes}><button className="rounded-lg border border-line px-3 py-1.5 text-sm hover:border-brand">Entendi</button></form>
    </div>
  )
}
