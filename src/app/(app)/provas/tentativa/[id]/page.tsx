import Link from 'next/link'
import { notFound } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase/server'
import { carregarProva, carregarRespostas } from '@/lib/provas-data'
import { salvarGabarito, descartarTentativa, iniciarTentativa } from '@/lib/provas'
import { corrigir, resultadoPorArea, relogio, faixas, gabaritoEmTexto, ehLetra } from '@/lib/engine/provas'
import { MOTIVOS, type Motivo } from '@/lib/engine/questoes'
import { COR_AREA } from '@/lib/engine/areas'
import { carregarAreas, comArea } from '@/lib/areas-data'
import { Bar, inputCls } from '@/components/ui'
import AvisoDaUrl from '@/components/AvisoDaUrl'
import FazerProva from '@/components/provas/FazerProva'
import CorrecaoErros, { type ItemCorrecao } from '@/components/provas/CorrecaoErros'
import { Enunciado } from '@/components/provas/Enunciado'

export default async function Tentativa({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ ok?: string; erro?: string }> }) {
  const [{ id }, { ok, erro }] = await Promise.all([params, searchParams])
  const sb = await supabaseServer()
  const { data: t } = await sb.from('prova_tentativas').select('id,prova_id,status,tempo_seg,atual,total,acertos,mock_exam_id').eq('id', id).maybeSingle()
  if (!t) notFound()
  const dados = await carregarProva(sb, t.prova_id, t.status !== 'entregue')
  if (!dados) notFound()
  const { prova, questoes } = dados
  const rs = await carregarRespostas(sb, id)
  const avisos = <>{erro && <AvisoDaUrl tipo="erro" chaves={['erro']}>{erro}</AvisoDaUrl>}</>

  // 1) Em andamento: a prova
  if (t.status === 'em_andamento') {
    const respostas = Object.fromEntries(rs.map(r => [r.questao_id, { alternativa: ehLetra(r.alternativa) ? r.alternativa : null, chute: !!r.chute, marcada: !!r.marcada, riscadas: r.riscadas ?? '' }]))
    return (
      <div className="space-y-4">
        {avisos}
        <FazerProva tentativa={id} nome={prova.nome} tempoInicial={t.tempo_seg} atualInicial={t.atual} respostas={respostas}
          questoes={questoes.map(q => ({ id: q.id, numero: q.numero, blocos: q.blocos, alternativas: q.alternativas }))} />
        <details className="rounded-2xl border border-line p-4 text-sm">
          <summary className="cursor-pointer text-muted">Desistir desta tentativa…</summary>
          <form action={descartarTentativa} className="mt-3 space-y-2"><input type="hidden" name="tentativa" value={id} />
            <p className="text-muted">Apaga as respostas desta tentativa. Nada vai para Simulados nem para o caderno.</p>
            <button className="rounded-xl border border-danger px-4 py-2 text-danger">Descartar tentativa</button></form>
        </details>
      </div>)
  }

  // 2) Entregue, mas sem gabarito completo: pedir o gabarito
  if (t.status === 'entregue') {
    const falta = questoes.filter(q => !q.anulada && !q.gabarito).map(q => q.numero)
    return (
      <div className="space-y-6">
        {avisos}
        <div className="space-y-1"><Link href="/provas" className="text-sm text-muted hover:text-brand">← Provas</Link><h1 className="text-2xl font-semibold">{prova.nome}: prova entregue</h1></div>
        <form action={salvarGabarito} className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <input type="hidden" name="prova" value={prova.id} /><input type="hidden" name="tentativa" value={id} />
          <p>Para corrigir, falta o gabarito {falta.length === questoes.length ? 'da prova' : <>das questões <b>{faixas(falta)}</b></>}. Cole abaixo (o que já existe aparece no campo).</p>
          <textarea name="gabarito" rows={6} required defaultValue={gabaritoEmTexto(questoes)} placeholder="1-B 2-C 3-A ... (anulada: X)" className={inputCls + ' w-full font-mono'} />
          <button className="rounded-xl bg-brand px-5 py-3 font-medium text-black">Salvar gabarito e corrigir</button>
        </form>
        <p className="text-sm text-muted">Tempo de prova: {relogio(t.tempo_seg)}. Suas respostas estão guardadas; nada muda até a correção.</p>
      </div>)
  }

  // 3) Corrigida: resultado, por área e os erros para classificar
  const porQ = new Map(rs.map(r => [r.questao_id, r]))
  const c0 = corrigir(questoes, Object.fromEntries(rs.map(r => [r.questao_id, { alternativa: ehLetra(r.alternativa) ? r.alternativa : null, chute: !!r.chute }])))
  // vale o que foi gravado na correção (se o gabarito mudou depois, o resultado desta tentativa não muda)
  const c = { ...c0, itens: c0.itens.map(i => { const g = porQ.get(i.id)?.correta; return g == null || i.situacao === 'anulada' ? i : { ...i, situacao: g ? 'certa' as const : i.alternativa ? 'errada' as const : 'branco' as const } }) }
  const total = t.total ?? c.total, acertos = t.acertos ?? c.acertos, p = total ? Math.round((acertos / total) * 100) : 0
  const areas = resultadoPorArea(c.itens)
  const erroIds = rs.map(r => r.erro_id).filter(Boolean) as string[]
  const [{ data: erros }, { data: ds }, { data: ts }, mapaAreas] = await Promise.all([
    erroIds.length ? sb.from('error_notebook').select('id,motivo,discipline_id,topic_id').in('id', erroIds) : Promise.resolve({ data: [] as { id: string; motivo: string | null; discipline_id: string | null; topic_id: string | null }[] }),
    sb.from('disciplines').select('id,nome').order('ordem'), sb.from('topics').select('id,nome,discipline_id').order('nome'), carregarAreas(sb),
  ])
  const porErro = new Map((erros ?? []).map(e => [e.id, e]))
  const itens: ItemCorrecao[] = c.itens.flatMap(i => {
    const r = porQ.get(i.id), e = r?.erro_id ? porErro.get(r.erro_id) : undefined, q = questoes.find(x => x.id === i.id)!
    if (!e) return []
    return [{ erroId: e.id, numero: i.numero, situacao: i.situacao, chute: i.chute, alternativa: i.alternativa, gabarito: i.gabarito,
      motivo: e.motivo && e.motivo in MOTIVOS ? (e.motivo as Motivo) : null, alvo: e.topic_id ? `t:${e.topic_id}` : e.discipline_id ? `d:${e.discipline_id}` : '',
      blocos: q.blocos, alternativas: q.alternativas }]
  })
  const semMotivo = itens.filter(i => !i.motivo).length
  const card = (l: string, v: string, s?: string) => <div className="rounded-2xl border border-line bg-surface p-4"><p className="text-sm text-muted">{l}</p><p className="mt-1 text-2xl font-semibold">{v}</p>{s && <p className="text-xs text-muted">{s}</p>}</div>
  return (
    <div className="space-y-6">
      {avisos}
      {ok === 'corrigida' && <AvisoDaUrl tipo="ok" chaves={['ok']}>Prova corrigida: {acertos}/{total} ({p}%). {itens.length} {itens.length === 1 ? 'questão foi' : 'questões foram'} para o Caderno de Erros.</AvisoDaUrl>}
      <div className="space-y-1"><Link href="/provas" className="text-sm text-muted hover:text-brand">← Provas</Link><h1 className="text-2xl font-semibold">{prova.nome}: resultado</h1></div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {card('Acertos', `${acertos}/${total}`, `${p}%`)}{card('Tempo', relogio(t.tempo_seg), total ? `${Math.round(t.tempo_seg / total / 6) / 10} min por questão` : undefined)}
        {card('Em branco', String(c.brancos))}{card('Acertos no chute', String(c.chutesCertos), c.anuladas ? `${c.anuladas} anulada(s) fora da conta` : undefined)}
      </div>
      {areas.length > 0 && (
        <section className="space-y-3 rounded-2xl border border-line bg-surface p-5">
          <h2 className="font-medium">Por área</h2>
          {areas.map(a => (
            <div key={a.area ?? 'sem'} className="grid grid-cols-[minmax(0,9rem)_1fr_6rem] items-center gap-3 text-sm sm:grid-cols-[14rem_1fr_7rem]">
              <span className="truncate">{a.rotulo}</span><Bar pct={a.pct ?? 0} cor={a.area ? COR_AREA[a.area] : '#8A9A93'} />
              <span className="text-right text-muted">{a.acertos}/{a.total} · {a.pct}%</span>
            </div>))}
        </section>)}
      <section className="space-y-3">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h2 className="font-medium">Para o Caderno de Erros ({itens.length})</h2>
          {semMotivo > 0 && <span className="text-sm text-warn">{semMotivo} sem motivo</span>}
        </div>
        <p className="text-sm text-muted">Já estão no caderno. Diga o motivo e a disciplina (ou o assunto) de cada uma: cada toque é salvo na hora.</p>
        {itens.length ? <CorrecaoErros itens={itens} ds={comArea(ds ?? [], mapaAreas.mapa)} ts={ts ?? []} />
          : <p className="rounded-2xl border border-dashed border-line p-6 text-center text-muted">Nenhum erro nesta prova.</p>}
      </section>
      <details className="rounded-2xl border border-line bg-surface p-4">
        <summary className="cursor-pointer text-sm text-muted">Revisar todas as questões</summary>
        <ol className="mt-4 space-y-6">{c.itens.map(i => { const q = questoes.find(x => x.id === i.id)!; return (
          <li key={i.id} className="space-y-2 border-t border-line pt-4 text-sm">
            <p className="font-medium">Questão {i.numero} · <span className={i.situacao === 'certa' ? 'text-brand' : i.situacao === 'anulada' ? 'text-muted' : 'text-danger'}>
              {{ certa: 'Certa', errada: 'Errada', branco: 'Em branco', anulada: 'Anulada' }[i.situacao]}</span></p>
            <Enunciado blocos={q.blocos} numero={q.numero} />
            <ul className="space-y-1">{q.alternativas.map(a => (
              <li key={a.letra} className={`rounded-lg px-2 py-1 ${a.letra === i.gabarito ? 'bg-brand/15 text-brand' : a.letra === i.alternativa ? 'bg-danger/10 text-danger' : ''}`}><b>{a.letra})</b> {a.texto}</li>))}</ul>
          </li>) })}</ol>
      </details>
      <div className="flex flex-wrap gap-2">
        <form action={iniciarTentativa}><input type="hidden" name="prova" value={prova.id} /><button className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Refazer a prova</button></form>
        <Link href="/caderno-de-erros" className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Abrir o Caderno de Erros</Link>
        {t.mock_exam_id && <Link href="/simulados" className="rounded-xl border border-line px-4 py-2 text-sm hover:border-brand">Ver em Simulados</Link>}
      </div>
    </div>)
}
