import Link from 'next/link'
import { Bar } from '@/components/ui'
import { descreverRitmo, type Ritmo, type Tom } from '@/lib/engine/ritmo'
import type { ModoRitmo } from '@/lib/ritmo-data'

const num = (n: number) => (Math.round(n * 10) / 10).toLocaleString('pt-BR', { minimumFractionDigits: 0, maximumFractionDigits: 1 })
const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`
const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`
const assuntos = (n: number) => `${n} ${n === 1 ? 'assunto' : 'assuntos'}`
// tons suaves: verde quando vai bem, azul para "dá para ajustar", cinza enquanto mede. Sem vermelho nem laranja de alerta.
const TOM: Record<Tom, { cls: string; cor: string }> = { bom: { cls: 'text-brand', cor: '#22C55E' }, ajuste: { cls: 'text-info', cor: '#60A5FA' }, neutro: { cls: 'text-muted', cor: '#8B8F98' } }

/** Estados em que não há conta a mostrar: só um convite para completar o que falta. Devolve null quando há ritmo para exibir. */
function convite(r: Ritmo) {
  if (r.estado === 'sem_assuntos') return <>Adicione ou importe os seus assuntos em <Link href="/cronograma" className="text-brand underline">Cronograma</Link> para acompanhar o ritmo.</>
  if (r.estado === 'sem_prova') return <>Defina a data da prova em <Link href="/configuracoes" className="text-brand underline">Configurações</Link> para acompanhar o ritmo.</>
  if (r.estado === 'prova_passou') return <>A data da prova já passou. Atualize em <Link href="/configuracoes" className="text-brand underline">Configurações</Link>.</>
  return null
}

/** Uma linha discreta, só com fatos: nada de status nem de cores. */
export function RitmoLinha({ r }: { r: Ritmo }) {
  const c = convite(r)
  if (c) return <p className="rounded-xl border border-line px-4 py-2.5 text-sm text-muted">{c}</p>
  return (
    <p className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-line px-4 py-2.5 text-sm text-muted">
      <span>{r.estado === 'concluido' ? `Todos os assuntos concluídos · prova em ${dias(r.diasAteProva ?? 0)}` : `Prova em ${dias(r.diasAteProva ?? 0)} · ${assuntos(r.restantes)} ${r.restantes === 1 ? 'restante' : 'restantes'}`}</span>
      <Link href="/cronograma" className="text-brand hover:underline">Ver ritmo</Link>
    </p>)
}

/** Ritmo completo: meta pequena da semana, projeção só quando está perto do prazo e o resto como referência. */
export function RitmoCompleto({ r }: { r: Ritmo }) {
  const casca = (children: React.ReactNode) => <section className="space-y-3 rounded-2xl border border-line bg-surface p-5" aria-label="Ritmo para a prova"><h2 className="text-sm text-muted">Ritmo para a prova</h2>{children}</section>
  const c = convite(r)
  if (c) return casca(<p className="text-sm text-muted">{c}</p>)
  if (r.estado === 'concluido') return casca(<><p className="text-2xl font-semibold text-brand">Todos os assuntos concluídos</p><p className="text-sm text-muted">Agora é revisão e questões. Faltam {dias(r.diasAteProva ?? 0)} para a prova.</p></>)

  const d = descreverRitmo(r), t = TOM[d.tom], meta = r.metaSemana, feitos = r.feitosSemana ?? 0
  const pct = meta ? Math.min(100, Math.round((feitos / meta) * 100)) : 0
  return casca(
    <>
      <div className="flex flex-wrap items-baseline justify-between gap-2"><p className={`text-2xl font-semibold ${t.cls}`}>{d.rotulo}</p><span className="text-sm text-muted">prova em {dias(r.diasAteProva ?? 0)}</span></div>
      <p className="text-sm">Faltam <b>{r.restantes}</b> {r.restantes === 1 ? 'assunto' : 'assuntos'}.</p>
      {meta != null
        ? <div className="space-y-1.5">
            <div className="flex items-baseline justify-between text-sm"><span className="text-muted">Meta da semana</span><span className="font-semibold">{feitos} de {meta}</span></div>
            <Bar pct={pct} cor={t.cor} />
            {feitos >= meta && <p className="text-sm text-brand">Meta da semana cumprida.</p>}
          </div>
        : <p className="text-sm text-muted">Como referência, para terminar no prazo seriam cerca de {Math.ceil(r.necessario ?? 0)} assuntos por semana.</p>}
      {d.frase && <p className="text-sm text-muted">{d.frase}</p>}
      {d.passo && feitos < (meta ?? 0) && <p className="text-sm">{d.passo} <span className="text-muted">Você pode também ajustar o tempo em <Link href="/semana" className="text-brand underline">Meu tempo</Link>.</span></p>}
      {(r.semData ?? 0) > 0 && (r.comData ?? 0) > 0 && <p className="text-sm text-muted">{r.semData} {r.semData === 1 ? 'assunto ainda não tem' : 'assuntos ainda não têm'} data no plano. Atualize o cronograma ou ajuste o tempo em Meu tempo.</p>}
      {r.atual != null && <p className="text-xs text-muted">Ritmo recente: {num(r.atual)} por semana · referência para o prazo: {num(r.necessario ?? 0)} por semana. Prazo para terminar os assuntos: {dm(r.prazo ?? '')}; os dias finais ficam para questões e simulados.</p>}
      {r.atual == null && <p className="text-xs text-muted">Prazo para terminar os assuntos: {dm(r.prazo ?? '')}; os dias finais ficam para questões e simulados.</p>}
      <p className="text-xs text-muted">Você escolhe como ver isto em <Link href="/configuracoes" className="underline">Configurações</Link>.</p>
    </>)
}

/** No Início, por padrão só a linha; o ritmo completo fica no Cronograma. A pessoa pode pedir o completo ou ocultar tudo. */
export function RitmoCard({ r, modo, onde }: { r: Ritmo; modo: ModoRitmo; onde: 'inicio' | 'cronograma' }) {
  if (modo === 'oculto') return null
  if (onde === 'inicio' && modo === 'resumo') return <RitmoLinha r={r} />
  return <RitmoCompleto r={r} />
}
