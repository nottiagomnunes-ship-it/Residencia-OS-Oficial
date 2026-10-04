import { carregarGamificacao } from '@/lib/gamificacao-data'
import { NivelCard, RankCard, SequenciaCard } from '@/components/Gamificacao'
import { carregarMetas } from '@/lib/metas-data'
import { carregarDesempenho } from '@/lib/desempenho-data'
import { hojeBR } from '@/lib/dates'
import Link from 'next/link'
import TarefasHoje from '@/components/TarefasHoje'
import { agendaDosDias } from '@/lib/agenda-data'
import { capacidadeDoDia, semanaAAvisar, planoDesatualizado } from '@/lib/engine/tempo'
import { AvisosPlano } from '@/components/AvisosPlano'
import { RitmoCard } from '@/components/RitmoCard'
import { carregarRitmo, carregarModoRitmo } from '@/lib/ritmo-data'
import { addDays } from '@/lib/engine/review'
import { weekStart } from '@/lib/engine/calendar'
import { supabaseServer } from '@/lib/supabase/server'
import { carregarFilaRefazer } from '@/lib/banco-data'

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
  const sb = await supabaseServer() // o layout já conferiu o login; aqui a RLS garante que só vêm os seus dados
  const hoje = hojeBR(), segProx = addDays(weekStart(hoje), 7)
  // tudo ao mesmo tempo: antes eram ~12 idas ao banco em fila
  const [{ data: p }, hojeQ, atrasQ, des, metas, gam, { data: itensHoje }, { count: concluidasHoje }, { data: capHoje }, { data: perfilTempo }, agenda,
    { data: capsSemana }, { data: perfilPlano }, { data: adi }, { data: feitosHoje }, modoRitmo, ritmoCalc, refazer] = await Promise.all([
    sb.from('profiles').select('nome').single(),
    sb.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pendente').eq('due_date', hoje),
    sb.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pendente').lt('due_date', hoje),
    carregarDesempenho(sb, hoje), carregarMetas(sb, hoje), carregarGamificacao(sb, hoje),
    sb.from('schedule_items').select('id,tipo,titulo,data,hora_ini,hora_fim,duracao_min,topic_id,qtd_questoes').lte('data', hoje).neq('status', 'concluido').order('data').order('ordem_dia', { nullsFirst: false }).order('hora_ini', { nullsFirst: false }).limit(60),
    sb.from('schedule_items').select('id', { count: 'exact', head: true }).eq('data', hoje).eq('status', 'concluido'),
    sb.from('capacidade_dia').select('minutos').eq('data', hoje).maybeSingle(), sb.from('profiles').select('daily_minutes,available_weekdays').single(),
    agendaDosDias(sb, hoje, hoje),
    sb.from('capacidade_dia').select('data,minutos').gte('data', hoje).lte('data', addDays(segProx, 6)),
    sb.from('profiles').select('plano_gerado_em,capacidade_alterada_em,semana_aviso').single(),
    sb.from('schedule_items').select('id,titulo,data,duracao_min').gt('data', hoje).lte('data', addDays(hoje, 14)).neq('status', 'concluido').in('tipo', ['estudo', 'questoes', 'flashcards']).order('data').order('ordem_dia', { nullsFirst: false }).limit(12),
    sb.from('schedule_items').select('duracao_min').eq('data', hoje).eq('status', 'concluido'),
    carregarModoRitmo(sb), carregarRitmo(sb, hoje), carregarFilaRefazer(sb, hoje, addDays(hoje, 7)),
  ])
  const totQ = des.total, acQ = des.acertos
  const metasSem = metas.filter(m => m.periodo === 'semana')
  const progSem = metasSem.length ? Math.round(metasSem.reduce((n, m) => n + Math.min(100, m.pct), 0) / metasSem.length) : null
  const agendaHoje = agenda.sugestoes[hoje] ?? null // só sugere; o tempo muda com um toque
  const tempoHoje = capacidadeDoDia(hoje, capHoje ? { [hoje]: capHoje.minutos } : {}, perfilTempo?.daily_minutes ?? 120, perfilTempo?.available_weekdays ?? [1, 2, 3, 4, 5])
  const recursos = !!perfilPlano // a migração 0021 foi aplicada (sem ela, só os avisos e os botões novos ficam de fora)
  const alvoSemana = recursos ? semanaAAvisar(hoje, Object.fromEntries((capsSemana ?? []).map(c => [c.data as string, c.minutos as number]))) : null
  const semanaAviso = alvoSemana && perfilPlano?.semana_aviso !== alvoSemana ? alvoSemana : null
  const desatualizado = recursos && planoDesatualizado(perfilPlano?.capacidade_alterada_em, perfilPlano?.plano_gerado_em)
  const minutosFeitos = (feitosHoje ?? []).reduce((s, x) => s + (x.duracao_min ?? 30), 0)
  const ritmo = modoRitmo === 'oculto' ? null : ritmoCalc
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
      <AvisosPlano desatualizado={desatualizado} semana={semanaAviso} semanaAtual={!!semanaAviso && semanaAviso <= hoje} />
      <TarefasHoje itens={itensHoje ?? []} hoje={hoje} concluidasHoje={concluidasHoje ?? 0} minutosHoje={tempoHoje.minutos} informado={tempoHoje.informado} minutosFeitos={minutosFeitos} adiantaveis={adi ?? []} recursos={recursos} agenda={agendaHoje} />
      {refazer && refazer.hoje > 0 && <Link href="/banco/praticar?revisao=1" className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-info/40 bg-info/10 p-4">
        <span><b className="font-medium">🔁 {refazer.hoje} {refazer.hoje === 1 ? 'questão errada para refazer hoje' : 'questões erradas para refazer hoje'}</b>
          <span className="block text-sm text-muted">As que você errou voltam em 1, 7 e 30 dias até você fixar.</span></span>
        <span className="font-medium text-info">Refazer →</span></Link>}
      {alerta && <Link href="/desempenho" className="block rounded-2xl border border-warn/40 bg-warn/10 p-4"><p className="font-medium">{alerta.titulo}</p><p className="text-sm">{alerta.texto}</p></Link>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
        <Card titulo="Revisões de hoje" valor={String(rev)} cor="text-info" />
        <Card titulo="Revisões atrasadas" valor={String(atras)} cor={atras ? 'text-danger' : 'text-brand'} />
        <Card titulo="Questões" valor={String(totQ)} detalhe={totQ ? `${Math.round((acQ / totQ) * 100)}% de acerto` : 'Registre sua primeira sessão'} />
        <Card titulo="Progresso semanal" valor={progSem == null ? '—' : `${progSem}%`} detalhe={progSem == null ? 'Crie metas semanais em Metas' : `${metasSem.length} ${metasSem.length === 1 ? 'meta semanal' : 'metas semanais'}`} />
      </div>
      {ritmo && <RitmoCard r={ritmo} modo={modoRitmo} onde="inicio" />}
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3"><NivelCard g={gam} /><RankCard g={gam} /><SequenciaCard g={gam} /></div>
    </div>
  )
}
