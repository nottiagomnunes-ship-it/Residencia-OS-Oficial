/** O traçado do batimento (o símbolo do R1TMO). Usa a cor da marca do tema atual. */
export function Pulso({ className = 'h-5 w-9', espessura = 9 }: { className?: string; espessura?: number }) {
  return (
    <svg viewBox="0 0 112 64" fill="none" aria-hidden className={className}>
      <polyline points="0,36 26,36 34,20 42,50 54,6 64,58 72,36 112,36" stroke="currentColor" strokeWidth={espessura} strokeLinecap="round" strokeLinejoin="round" />
    </svg>)
}

/** Logo do R1TMO: o batimento e o nome, com o "1" na cor da marca. `tamanho` escolhe a escala (menu, tela de entrada). */
export default function Marca({ tamanho = 'md', soSimbolo = false }: { tamanho?: 'sm' | 'md' | 'lg'; soSimbolo?: boolean }) {
  const t = { sm: { s: 'h-4 w-7', txt: 'text-base' }, md: { s: 'h-5 w-9', txt: 'text-xl' }, lg: { s: 'h-8 w-14', txt: 'text-4xl' } }[tamanho]
  return (
    <span className="inline-flex items-center gap-2 text-ink" aria-label="R1TMO" role="img">
      <Pulso className={`${t.s} shrink-0 text-brand`} />
      {!soSimbolo && <span aria-hidden className={`font-display font-bold tracking-tight ${t.txt}`}>R<span className="text-brand">1</span>TMO</span>}
    </span>)
}
