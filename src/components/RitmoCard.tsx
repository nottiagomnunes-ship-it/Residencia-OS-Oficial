import Link from 'next/link'
import { Bar } from '@/components/ui'
import type { Ritmo, StatusRitmo } from '@/lib/engine/ritmo'

const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`
const dma = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const plural = (n: number, um: string, varios: string) => `${num(n)} ${n === 1 ? um : varios}`
const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`

const ROTULO: Record<StatusRitmo, { texto: string; cls: string; cor: string }> = {
  adiantado: { texto: 'Adiantado', cls: 'text-brand', cor: '#22C55E' },
  no_ritmo: { texto: 'No ritmo', cls: 'text-brand', cor: '#22C55E' },
  um_pouco_atras: { texto: 'Um pouco atrás do ritmo', cls: 'text-warn', cor: '#F59E0B' },
  atrasado: { texto: 'Atrás do ritmo', cls: 'text-danger', cor: '#EF4444' },
  sem_historico: { texto: 'Medindo o seu ritmo', cls: 'text-muted', cor: '#8B8F98' },
}

/** Responde "estou no ritmo para terminar os assuntos antes da prova?" comparando o seu ritmo com o necessário. */
export function RitmoCard({ r }: { r: Ritmo }) {
  const casca = (children: React.ReactNode) => <section className="space-y-2 rounded-2xl border border-line bg-surface p-5" aria-label="Ritmo para a prova"><h2 className="text-sm text-muted">Ritmo para a prova</h2>{children}</section>
  if (r.estado === 'sem_assuntos') return casca(<p className="text-sm text-muted">Adicione ou importe os seus assuntos em <Link href="/cronograma" className="text-brand underline">Cronograma</Link> para acompanhar o ritmo.</p>)
  if (r.estado === 'sem_prova') return casca(<p className="text-sm text-muted">Defina a data da prova em <Link href="/configuracoes" className="text-brand underline">Configurações</Link> para acompanhar o ritmo.</p>)
  if (r.estado === 'prova_passou') return casca(<p className="text-sm text-muted">A data da prova já passou. Atualize em <Link href="/configuracoes" className="text-brand underline">Configurações</Link>.</p>)
  if (r.estado === 'concluido') return casca(<><p className="text-2xl font-semibold text-brand">Todos os assuntos concluídos</p><p className="text-sm text-muted">Agora é revisão e questões. Faltam {dias(r.diasAteProva ?? 0)} para a prova.</p></>)

  const s = ROTULO[r.status ?? 'sem_historico'], nec = r.necessario ?? 0, atual = r.atual
  const atras = r.status === 'um_pouco_atras' || r.status === 'atrasado'
  const frase =
    r.status === 'sem_historico' ? 'Conclua assuntos por mais alguns dias para o app medir o seu ritmo.'
    : r.projecao == null ? 'Nenhum assunto concluído nas últimas semanas, então não há projeção ainda.'
    : (r.margemDias ?? 0) >= 7 ? `No ritmo atual você termina em ${dma(r.projecao)}, ${dias(r.margemDias!)} antes do prazo.`
    : (r.margemDias ?? 0) >= -3 ? `No ritmo atual você termina por volta do prazo (${dma(r.projecao)}).`
    : `No ritmo atual você terminaria em ${dma(r.projecao)}, ${dias(-r.margemDias!)} depois do prazo.`
  const pct = atual == null || nec <= 0 ? 0 : Math.min(100, Math.round((atual / nec) * 100))
  return casca(
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2"><p className={`text-2xl font-semibold ${s.cls}`}>{s.texto}</p><span className="text-sm text-muted">prova em {dias(r.diasAteProva ?? 0)}</span></div>
      <p className="text-sm">Faltam <b>{r.restantes}</b> {r.restantes === 1 ? 'assunto' : 'assuntos'} · {frase}</p>
      <div className="grid grid-cols-2 gap-3 text-sm">
        <div><p className="text-muted">Seu ritmo</p><p className="text-lg font-semibold">{atual == null ? '—' : `${num(atual)}/semana`}</p></div>
        <div><p className="text-muted">Necessário</p><p className="text-lg font-semibold">{num(nec)}/semana</p></div>
      </div>
      {atual != null && <Bar pct={pct} cor={s.cor} />}
      {atras && <p className="text-sm">Faltam {plural(r.faltaPorSemana ?? 0, 'assunto', 'assuntos')} por semana para alcançar o ritmo. <span className="text-muted">Você pode aumentar o tempo em <Link href="/semana" className="text-brand underline">Minha semana</Link> ou deixar os assuntos de menor prioridade para depois.</span></p>}
      {(r.semData ?? 0) > 0 && (r.comData ?? 0) > 0 && <p className="text-sm text-warn">{r.semData} {r.semData === 1 ? 'assunto ainda está' : 'assuntos ainda estão'} sem data no plano. Atualize o cronograma ou aumente o tempo em Minha semana.</p>}
      <p className="text-xs text-muted">Prazo para terminar os assuntos: {dm(r.prazo ?? '')}. Os dias finais antes da prova ficam para questões e simulados.</p>
    </>)
}
