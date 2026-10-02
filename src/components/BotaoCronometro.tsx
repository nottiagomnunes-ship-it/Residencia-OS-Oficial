'use client'
import { useCronometro } from '@/components/CronometroProvider'

/** Inicia o cronômetro de uma tarefa ('icone' nas listas, 'texto' nos detalhes) ou um cronômetro livre ('livre'). Some se o recurso não está disponível. */
export default function BotaoCronometro({ itemId, titulo, variante = 'icone' }: { itemId: string | null; titulo: string; variante?: 'icone' | 'texto' | 'livre' }) {
  const c = useCronometro()
  if (!c.disponivel) return null
  const dele = !!itemId && c.ativo?.item_id === itemId
  if (dele) return variante === 'texto' ? <span className="rounded-xl border border-brand px-4 py-2 text-sm text-brand">⏱ Cronômetro em andamento</span> : <span className="px-1 text-xs text-brand" title="Cronômetro em andamento">⏱</span>
  if (c.ativo) return null   // só há um cronômetro por vez: enquanto houver um, os outros botões saem de cena
  const clicar = (e: React.MouseEvent) => { e.preventDefault(); e.stopPropagation(); c.iniciar(itemId, titulo) }
  if (variante === 'texto') return <button type="button" onClick={clicar} disabled={c.ocupado} className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand disabled:opacity-60">▶ Iniciar cronômetro</button>
  if (variante === 'livre') return <button type="button" onClick={clicar} disabled={c.ocupado} className="rounded-xl border border-line px-3 py-1.5 text-sm hover:border-brand disabled:opacity-60">⏱ Cronômetro livre</button>
  return <button type="button" onClick={clicar} disabled={c.ocupado} aria-label={`Iniciar cronômetro: ${titulo}`} title="Iniciar cronômetro" className="grid size-9 shrink-0 place-items-center rounded-full border border-line text-sm hover:border-brand disabled:opacity-60">▶</button>
}
