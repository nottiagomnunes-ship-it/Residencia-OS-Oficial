import { diffDays } from './review'

export type DadosLembrete = {
  nome: string | null; hoje: string
  atrasadas: { nome: string; dias: number; intervalo: number }[]
  revisoesHoje: { nome: string; intervalo: number }[]
  tarefas: { titulo: string; tipo: string; ini: string | null }[]
  erros: number
}
type RevisaoBruta = { due_date: string; interval_days: number; nome: string }
type TarefaBruta = { titulo: string; tipo: string; hora_ini: string | null }

/** Organiza os dados brutos: revisões atrasadas (mais antigas primeiro) e de hoje; tarefas de hoje por horário. */
export function montarDados(nome: string | null, hoje: string, revisoes: RevisaoBruta[], itens: TarefaBruta[], erros: number): DadosLembrete {
  return {
    nome, hoje, erros,
    atrasadas: revisoes.filter(r => r.due_date < hoje).sort((a, b) => a.due_date.localeCompare(b.due_date) || a.interval_days - b.interval_days)
      .map(r => ({ nome: r.nome, dias: diffDays(r.due_date, hoje), intervalo: r.interval_days })),
    revisoesHoje: revisoes.filter(r => r.due_date === hoje).sort((a, b) => a.interval_days - b.interval_days).map(r => ({ nome: r.nome, intervalo: r.interval_days })),
    tarefas: [...itens].sort((a, b) => (a.hora_ini ?? '99:99').localeCompare(b.hora_ini ?? '99:99')).map(t => ({ titulo: t.titulo, tipo: t.tipo, ini: t.hora_ini?.slice(0, 5) ?? null })),
  }
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const MAX = 8

/** Monta o e-mail (assunto, HTML e texto). `vazio` = não há nada pendente (o envio automático é pulado nesse caso). */
export function montarLembrete(d: DadosLembrete, urlApp: string) {
  const dia = new Date(d.hoje + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' }).replace('-feira', '')
  const rotulo = `${dia}, ${d.hoje.slice(8)}/${d.hoje.slice(5, 7)}`
  const nRev = d.atrasadas.length + d.revisoesHoje.length
  const vazio = nRev === 0 && d.tarefas.length === 0 && d.erros === 0
  const partes = [
    nRev ? plural(nRev, 'revisão', 'revisões') + (d.atrasadas.length ? ` (${plural(d.atrasadas.length, 'atrasada', 'atrasadas')})` : '') : '',
    d.tarefas.length ? plural(d.tarefas.length, 'tarefa', 'tarefas') : '',
    !nRev && !d.tarefas.length && d.erros ? plural(d.erros, 'erro para revisar', 'erros para revisar') : '',
  ].filter(Boolean)
  const assunto = `Residência OS · ${rotulo}: ${partes.length ? partes.join(' e ') : 'nada pendente'}`
  const saudacao = d.nome ? `Bom dia, ${d.nome.split(' ')[0]}!` : 'Bom dia!'

  const linhasAtraso = d.atrasadas.map(r => `${r.nome} — D${r.intervalo}, ${plural(r.dias, 'dia', 'dias')} de atraso`)
  const linhasRev = d.revisoesHoje.map(r => `${r.nome} — D${r.intervalo}`)
  const linhasTar = d.tarefas.map(t => `${t.ini ? t.ini + ' · ' : ''}${t.titulo}`)
  const cortar = (l: string[]) => [...l.slice(0, MAX), ...(l.length > MAX ? [`e mais ${l.length - MAX}`] : [])]
  const secoes: [string, string[]][] = [
    [`Revisões atrasadas (${linhasAtraso.length})`, linhasAtraso], [`Revisões de hoje (${linhasRev.length})`, linhasRev], [`Tarefas de hoje (${linhasTar.length})`, linhasTar],
  ]
  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#111;line-height:1.5">
<h2 style="margin:0 0 4px">${esc(saudacao)}</h2><p style="margin:0 0 16px;color:#555">Seu resumo de ${esc(rotulo)}.</p>
${vazio ? '<p>Nada pendente para hoje. Bom descanso ou bom estudo livre!</p>' : ''}
${secoes.filter(([, l]) => l.length).map(([t, l]) => `<h3 style="margin:18px 0 4px;font-size:16px">${esc(t)}</h3><ul style="padding-left:20px;margin:6px 0">${cortar(l).map(x => `<li style="margin:4px 0">${esc(x)}</li>`).join('')}</ul>`).join('\n')}
${d.erros ? `<p style="margin-top:18px">${esc(plural(d.erros, 'erro do caderno', 'erros do caderno'))} para revisar hoje.</p>` : ''}
<p style="margin:24px 0"><a href="${esc(urlApp)}/revisoes" style="background:#22C55E;color:#000;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Abrir o Residência OS</a></p>
<p style="color:#777;font-size:12px">Para parar de receber este e-mail, desative em Configurações → Lembretes por e-mail.</p></div>`
  const texto = [saudacao, `Seu resumo de ${rotulo}.`, vazio ? 'Nada pendente para hoje.' : '',
    ...secoes.filter(([, l]) => l.length).flatMap(([t, l]) => ['', t, ...cortar(l).map(x => `- ${x}`)]),
    d.erros ? `\n${plural(d.erros, 'erro do caderno', 'erros do caderno')} para revisar hoje.` : '', `\nAbrir: ${urlApp}/revisoes`, 'Para parar de receber, desative em Configurações → Lembretes por e-mail.'].filter(x => x !== '').join('\n')
  return { vazio, assunto, html, texto }
}
