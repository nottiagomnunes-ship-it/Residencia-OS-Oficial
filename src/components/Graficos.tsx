'use client'
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

type Serie = { semana: string; questoes: number; acerto: number | null; horas: number }
const eixo = { tick: { fill: '#8A9A93', fontSize: 12 }, stroke: '#1F2A26' }
const tip = { contentStyle: { background: '#111816', border: '1px solid #1F2A26', borderRadius: 12 }, cursor: { fill: 'rgba(255,255,255,0.04)' } }
const corPct = (p: number) => (p < 65 ? '#EF4444' : p < 75 ? '#F59E0B' : '#22C55E')
const Caixa = ({ t, children }: { t: string; children: React.ReactNode }) => (
  <section className="rounded-2xl border border-line bg-surface p-4"><h3 className="mb-3 text-sm text-muted">{t}</h3><div className="h-56"><ResponsiveContainer width="100%" height="100%">{children as any}</ResponsiveContainer></div></section>)

export default function Graficos({ serie, disciplinas, assuntos }: { serie: Serie[]; disciplinas: { nome: string; progresso: number }[]; assuntos: { nome: string; pct: number }[] }) {
  const grid = <CartesianGrid stroke="#1F2A26" vertical={false} />
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {serie.some(s => s.questoes > 0) && <>
        <Caixa t="Evolução do percentual de acerto"><LineChart data={serie}>{grid}<XAxis dataKey="semana" {...eixo} /><YAxis domain={[0, 100]} unit="%" {...eixo} /><Tooltip {...tip} formatter={(v: any) => `${v}%`} />
          <Line dataKey="acerto" name="Acerto" stroke="#22C55E" strokeWidth={2} connectNulls /></LineChart></Caixa>
        <Caixa t="Questões por semana"><BarChart data={serie}>{grid}<XAxis dataKey="semana" {...eixo} /><YAxis allowDecimals={false} {...eixo} /><Tooltip {...tip} /><Bar dataKey="questoes" name="Questões" fill="#3B82F6" radius={[6, 6, 0, 0]} /></BarChart></Caixa></>}
      {serie.some(s => s.horas > 0) && <Caixa t="Horas estudadas por semana"><BarChart data={serie}>{grid}<XAxis dataKey="semana" {...eixo} /><YAxis {...eixo} /><Tooltip {...tip} formatter={(v: any) => `${v} h`} /><Bar dataKey="horas" name="Horas" fill="#A855F7" radius={[6, 6, 0, 0]} /></BarChart></Caixa>}
      {disciplinas.length > 0 && <Caixa t="Progresso das disciplinas (conteúdos concluídos)"><BarChart data={disciplinas} layout="vertical">{grid}<XAxis type="number" domain={[0, 100]} unit="%" {...eixo} /><YAxis type="category" dataKey="nome" width={120} {...eixo} /><Tooltip {...tip} formatter={(v: any) => `${v}%`} /><Bar dataKey="progresso" name="Progresso" fill="#22C55E" radius={[0, 6, 6, 0]} /></BarChart></Caixa>}
      {assuntos.length > 0 && <Caixa t="Desempenho por assunto (os 8 mais fracos)"><BarChart data={assuntos} layout="vertical">{grid}<XAxis type="number" domain={[0, 100]} unit="%" {...eixo} /><YAxis type="category" dataKey="nome" width={120} {...eixo} /><Tooltip {...tip} formatter={(v: any) => `${v}%`} />
        <Bar dataKey="pct" name="Acerto" radius={[0, 6, 6, 0]}>{assuntos.map((a, i) => <Cell key={i} fill={corPct(a.pct)} />)}</Bar></BarChart></Caixa>}
    </div>
  )
}
