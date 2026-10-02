import { Bar, fmtData } from '@/components/ui'
import { ELOS, TITULOS, indiceTitulo, divisaoDoPasso } from '@/lib/engine/rank'
import type { carregarGamificacao } from '@/lib/gamificacao-data'
type G = Awaited<ReturnType<typeof carregarGamificacao>>

/** Escudo do elo, com a divisão (IV a I) ou uma estrela nos elos sem divisão. */
export function Emblema({ passo, cor, tamanho = 64 }: { passo: number; cor: string; tamanho?: number }) {
  const div = divisaoDoPasso(passo)
  return (
    <svg viewBox="0 0 80 92" width={tamanho} height={(tamanho * 92) / 80} role="img" aria-hidden className="shrink-0">
      <path d="M40 4 L74 17 V48 C74 68 59 82 40 90 C21 82 6 68 6 48 V17 Z" fill={cor} stroke={cor} strokeWidth="3" strokeLinejoin="round" />
      <path d="M40 4 L74 17 V48 C74 68 59 82 40 90 Z" fill="#000" opacity=".14" />
      <path d="M40 14 L66 24 V48 C66 62 55 74 40 81 C25 74 14 62 14 48 V24 Z" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.5" />
      <text x="40" y="57" textAnchor="middle" fontSize={div && div.length > 2 ? 22 : 28} fontWeight="700" fill="#0b0f14">{div ?? '★'}</text>
    </svg>)
}

export function NivelCard({ g }: { g: G }) {
  const n = g.nivel
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <div className="flex items-baseline justify-between"><h2 className="text-sm text-muted">Nível e título</h2><span className="text-sm text-muted">{g.xp} XP</span></div>
      <p className="mt-1 text-2xl font-semibold">{n.nome} <span className="text-base font-normal text-muted">· nível {n.nivel}</span></p>
      <div className="my-2"><Bar pct={n.pct} /></div>
      <p className="text-sm text-muted">Faltam {n.xpParaProximo} XP para o nível {n.nivel + 1}</p>
      {n.proximoTitulo && <p className="text-xs text-muted">Próximo título: {n.proximoTitulo.nome}, no nível {n.proximoTitulo.desde}</p>}
    </section>)
}

/** Ranking por assuntos concluídos: cada 10% sobe um elo; nos 7 primeiros há 4 divisões. */
export function RankCard({ g }: { g: G }) {
  const r = g.rank
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm text-muted">Ranking dos assuntos</h2>
      {!r.classificado
        ? <p className="mt-2 text-sm text-muted">Sem classificação ainda. Adicione ou importe seus assuntos em <a href="/cronograma" className="text-brand underline">Cronograma</a> para começar a subir de rank.</p>
        : <>
          <div className="mt-2 flex items-center gap-4">
            <Emblema passo={r.passo} cor={r.cor} tamanho={56} />
            <div className="min-w-0"><p className="text-2xl font-semibold" style={{ color: r.cor }}>{r.rotulo}</p>
              <p className="text-sm text-muted">{String(r.pct).replace('.', ',')}% dos assuntos concluídos · {r.concluidos} de {r.total}</p></div>
          </div>
          {r.proximo
            ? <><div className="my-2"><Bar pct={r.progresso} cor={r.cor} /></div><p className="text-sm text-muted">Faltam {r.proximo.faltam} {r.proximo.faltam === 1 ? 'assunto' : 'assuntos'} para {r.proximo.rotulo}</p></>
            : <p className="mt-2 text-sm text-brand">{r.pct >= 100 ? 'Todos os assuntos concluídos. Ranking máximo!' : 'Topo do ranking. Falta só terminar o que sobrou.'}</p>}
        </>}
    </section>)
}

/** Escada completa de elos e de títulos, com o ponto atual destacado. */
export function JornadaPanel({ g }: { g: G }) {
  const r = g.rank, ti = indiceTitulo(g.nivel.nivel)
  return (
    <section className="space-y-4">
      <h2 className="font-medium">Ranking e títulos</h2>
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">O ranking sobe com a porcentagem de assuntos concluídos: cada 10% é um elo, e do Ferro ao Diamante cada elo tem quatro divisões (IV a I), de 2,5% em 2,5%.</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
          {ELOS.map((e, i) => { const atual = r.classificado && r.elo === e.nome; return (
            <div key={e.nome} className={`rounded-xl border p-3 text-center ${atual ? 'border-2' : 'border-line opacity-70'}`} style={atual ? { borderColor: e.cor } : undefined}>
              <span className="mx-auto mb-1 block size-3 rounded-full" style={{ background: e.cor }} />
              <p className="text-sm font-medium">{e.nome}</p><p className="text-xs text-muted">{i * 10}–{i * 10 + 10}%</p>
              {atual && <p className="mt-1 text-xs" style={{ color: e.cor }}>Você está aqui</p>}
            </div>) })}
        </div>
      </div>
      <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
        <p className="text-sm text-muted">Os títulos vêm com o nível, que sobe a cada 500 XP.</p>
        <div className="flex flex-wrap gap-2">
          {TITULOS.map((t, i) => (
            <span key={t.nome} className={`rounded-full border px-3 py-1 text-sm ${i === ti ? 'border-brand bg-brand/15 text-brand' : i < ti ? 'border-line' : 'border-line text-muted opacity-60'}`}>
              {i < ti ? '✓ ' : ''}{t.nome} <span className="text-xs text-muted">· nível {t.desde}</span></span>))}
        </div>
      </div>
    </section>)
}
export function SequenciaCard({ g }: { g: G }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm text-muted">Sequência de estudo</h2>
      <p className="mt-1 text-2xl font-semibold">🔥 {g.sequencia.atual} {g.sequencia.atual === 1 ? 'dia' : 'dias'}</p>
      <p className="mt-2 text-sm text-muted">{g.sequencia.atual === 0 ? 'Estude hoje para começar uma sequência.' : `Melhor sequência: ${g.sequencia.melhor} dias`}</p>
    </section>)
}
export function ConquistasGrid({ g }: { g: G }) {
  const n = g.conquistas.filter(c => c.em).length
  return (
    <section className="space-y-3"><h2 className="font-medium">Conquistas <span className="text-sm font-normal text-muted">{n} de {g.conquistas.length}</span></h2>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{[...g.conquistas].sort((a, b) => Number(!!b.em) - Number(!!a.em)).map(c => (
        <div key={c.codigo} className={`rounded-2xl border p-4 ${c.em ? 'border-brand/40 bg-brand/5' : 'border-line bg-surface opacity-60'}`}>
          <p className="font-medium">{c.em ? '🏅 ' : ''}{c.titulo}{c.em && !c.visto && <span className="ml-2 rounded-full bg-brand px-2 py-0.5 text-xs font-normal text-black">Nova</span>}</p><p className="text-sm text-muted">{c.descricao}</p>
          {c.em && <p className="mt-1 text-xs text-brand">Desbloqueada em {fmtData(c.em.slice(0, 10))}</p>}
        </div>))}</div></section>)
}
