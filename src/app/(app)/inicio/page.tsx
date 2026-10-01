import { carregarGamificacao } from '@/lib/gamificacao-data'
import { NivelCard, SequenciaCard } from '@/components/Gamificacao'
import { carregarMetas } from '@/lib/metas-data'
import { carregarDesempenho } from '@/lib/desempenho-data'
import { hojeBR } from '@/lib/dates'
import Link from 'next/link'
import TarefasHoje from '@/components/TarefasHoje'
import { supabaseServer } from '@/lib/supabase/server'

function Card({ titulo, valor, detalhe, cor = 'text-brand' }: { titulo: string; valor: string; detalhe?: string; cor?: string }) {
  return (
    <section className="rounded-2xl border border-line bg-surface p-5">
      <h2 className="text-sm text-muted">{titulo}</h2>
      <p className={`mt-2 text-3xl font-semibold ${cor}`}>{valor}</p>
      {detalhe && <p className="mt-1 text-sm text-muted">{detalhe}</p>}
    </section>
  )
}

export default async function Inicio() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  const hoje = hojeBR()
  const [{ data: p }, hojeQ, atrasQ] = await Promise.all([
    sb.from('profiles').select('nome').eq('id', user!.id).single(),
    sb.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pendente').eq('due_date', hoje),
    sb.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pendente').lt('due_date', hoje),
  ])
  const des = await carregarDesempenho(sb, hoje)
  const totQ = des.total, acQ = des.acertos
  const metasSem = (await carregarMetas(sb, hoje)).filter(m => m.periodo === 'semana')
  const progSem = metasSem.length ? Math.round(metasSem.reduce((n, m) => n + Math.min(100, m.pct), 0) / metasSem.length) : null
  const gam = await carregarGamificacao(sb, hoje)
  const { data: itensHoje } = await sb.from('schedule_items').select('id,tipo,titulo,data,hora_ini,hora_fim').lte('data', hoje).neq('status', 'concluido').order('data').order('hora_ini', { nullsFirst: false }).limit(60)
  const { count: concluidasHoje } = await sb.from('schedule_items').select('id', { count: 'exact', head: true }).eq('data', hoje).eq('status', 'concluido')
  const alerta = des.foco[0]?.nivel === 'alta' ? { titulo: '🔴 Alta prioridade', texto: des.foco[0].frase } : des.recomendacoes[0] ? { titulo: '🟡 Atenção', texto: des.recomendacoes[0].texto } : null
  const h = Number(new Intl.DateTimeFormat('pt-BR', { hour: 'numeric', hourCycle: 'h23', timeZone: 'America/Sao_Paulo' }).format(new Date()))
  const saudacao = h < 12 ? 'Bom dia' : h < 18 ? 'Boa tarde' : 'Boa noite'
  const rev = hojeQ.count ?? 0, atras = atrasQ.count ?? 0
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">{saudacao}, {p?.nome?.split(' ')[0]} 👋</h1>
        <p className="text-muted">{rev + atras === 0 ? 'Nenhuma revisão pendente. Cadastre conteúdos para começar o plano.' : `Você tem ${rev} revisões para hoje e ${atras} atrasadas.`}</p>
      </header>
      <TarefasHoje itens={itensHoje ?? []} hoje={hoje} concluidasHoje={concluidasHoje ?? 0} />
      {alerta && <Link href="/desempenho" className="block rounded-2xl border border-warn/40 bg-warn/10 p-4"><p className="font-medium">{alerta.titulo}</p><p className="text-sm">{alerta.texto}</p></Link>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card titulo="Revisões de hoje" valor={String(rev)} cor="text-info" />
        <Card titulo="Revisões atrasadas" valor={String(atras)} cor={atras ? 'text-danger' : 'text-brand'} />
        <Card titulo="Questões" valor={String(totQ)} detalhe={totQ ? `${Math.round((acQ / totQ) * 100)}% de acerto` : 'Registre sua primeira sessão'} />
        <Card titulo="Progresso semanal" valor={progSem == null ? '—' : `${progSem}%`} detalhe={progSem == null ? 'Crie metas semanais em Metas' : `${metasSem.length} ${metasSem.length === 1 ? 'meta semanal' : 'metas semanais'}`} />
      </div>
      <div className="grid gap-4 md:grid-cols-2"><NivelCard g={gam} /><SequenciaCard g={gam} /></div>
    </div>
  )
}
