'use client'
import { ResponsiveContainer, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip } from 'recharts'

export default function EvolucaoSimulados({ dados }: { dados: { nome: string; pct: number }[] }) {
  const eixo = { tick: { fill: '#8A9A93', fontSize: 12 }, stroke: '#1F2A26' }
  return (
    <section className="rounded-2xl border border-line bg-surface p-4"><h2 className="mb-3 text-sm text-muted">Evolução nos simulados</h2>
      <div className="h-56"><ResponsiveContainer width="100%" height="100%"><LineChart data={dados}><CartesianGrid stroke="#1F2A26" vertical={false} /><XAxis dataKey="nome" {...eixo} /><YAxis domain={[0, 100]} unit="%" {...eixo} />
        <Tooltip contentStyle={{ background: '#111816', border: '1px solid #1F2A26', borderRadius: 12 }} formatter={(v: any) => `${v}%`} /><Line dataKey="pct" name="Acerto" stroke="#22C55E" strokeWidth={2} /></LineChart></ResponsiveContainer></div></section>
  )
}
