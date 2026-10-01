export const STATUS: Record<string, { label: string; cls: string; pct: number }> = {
  nao_iniciado: { label: 'Não iniciado', cls: 'bg-line text-muted', pct: 0 },
  planejado: { label: 'Planejado', cls: 'bg-info/15 text-info', pct: 0 },
  em_andamento: { label: 'Em andamento', cls: 'bg-warn/15 text-warn', pct: 50 },
  concluido: { label: 'Concluído', cls: 'bg-brand/15 text-brand', pct: 100 },
}
export const PRIORIDADE = ['', 'Alta', 'Média', 'Baixa']
export const NIVEL = ['', 'Fácil', 'Médio', 'Difícil']

export function Badge({ status }: { status: string }) {
  const s = STATUS[status]
  return <span className={`rounded-full px-2.5 py-0.5 text-xs ${s.cls}`}>{s.label}</span>
}
export function Bar({ pct, cor = '#22C55E' }: { pct: number; cor?: string }) {
  return <div className="h-2 overflow-hidden rounded-full bg-line" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100}>
    <div className="h-full rounded-full" style={{ width: `${pct}%`, background: cor }} /></div>
}
export const fmtData = (d?: string | null) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}` : '—')
export const inputCls = 'rounded-xl border border-line bg-bg px-3 py-2 text-sm outline-none focus:border-brand'
