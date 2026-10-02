import { diffDays } from './review'
import { dividirPorTempo, formatarMinutos } from './tempo'

export type TarefaLembrete = { titulo: string; tipo: string; duracao_min: number; atrasoDias: number }
export type DadosLembrete = {
  nome: string | null; hoje: string
  minutos: number; informado: boolean                  // tempo de estudo de hoje: o que a pessoa informou ou o tempo padrão
  cabem: TarefaLembrete[]; depois: TarefaLembrete[]    // o que cabe no tempo de hoje e o que fica para depois, na mesma ordem do app
  usado: number; maiorQueOTempo: boolean
  atrasadas: number                                    // quantas das tarefas abertas são de dias anteriores
  erros: number
}
type ItemBruto = { titulo: string; tipo: string; data: string; duracao_min: number | null }

/**
 * Organiza as tarefas abertas como o painel Hoje do app: as atrasadas primeiro (mais antigas antes) e depois as de hoje,
 * cada dia na ordem do plano (a ordem de chegada é mantida). Separa o que cabe no tempo de hoje do que fica para depois.
 */
export function montarDados(nome: string | null, hoje: string, itens: ItemBruto[], minutos: number, informado: boolean, erros: number): DadosLembrete {
  const tarefas: TarefaLembrete[] = [...itens].sort((a, b) => a.data.localeCompare(b.data))
    .map(i => ({ titulo: i.titulo, tipo: i.tipo, duracao_min: i.duracao_min ?? 30, atrasoDias: Math.max(0, diffDays(i.data, hoje)) }))
  const d = dividirPorTempo(tarefas, minutos)
  return { nome, hoje, minutos, informado, cabem: d.cabem, depois: d.sobram, usado: d.usado, maiorQueOTempo: d.maiorQueOTempo, atrasadas: tarefas.filter(t => t.atrasoDias > 0).length, erros }
}

const esc = (s: string) => s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!))
const plural = (n: number, um: string, varios: string) => `${n} ${n === 1 ? um : varios}`
const MAX = 8, MAX_DEPOIS = 5

/**
 * Monta o e-mail (assunto, HTML e texto). `vazio` = não há o que lembrar (o envio automático é pulado): nada pendente, ou sem tempo de estudo hoje.
 * O botão "enviar teste" ignora `vazio` e manda mesmo assim.
 */
export function montarLembrete(d: DadosLembrete, urlApp: string) {
  const dia = new Date(d.hoje + 'T12:00:00Z').toLocaleDateString('pt-BR', { weekday: 'long', timeZone: 'UTC' }).replace('-feira', '')
  const rotulo = `${dia}, ${d.hoje.slice(8)}/${d.hoje.slice(5, 7)}`
  const nTotal = d.cabem.length + d.depois.length
  const semTempo = d.minutos === 0
  const vazio = semTempo || (nTotal === 0 && d.erros === 0)

  const partes = [
    nTotal ? (semTempo ? 'sem tempo de estudo hoje' : `${plural(d.cabem.length, 'tarefa', 'tarefas')} para hoje (${formatarMinutos(d.usado)})`) : '',
    d.atrasadas ? plural(d.atrasadas, 'atrasada', 'atrasadas') : '',
    !nTotal && d.erros ? plural(d.erros, 'erro para revisar', 'erros para revisar') : '',
  ].filter(Boolean)
  const assunto = `Residência OS · ${rotulo}: ${partes.length ? partes.join(' · ') : 'nada pendente'}`
  const saudacao = d.nome ? `Bom dia, ${d.nome.split(' ')[0]}!` : 'Bom dia!'

  const tempoTxt = semTempo ? 'sem tempo' : formatarMinutos(d.minutos)
  const tempoNota = semTempo
    ? (d.informado ? 'Você informou que não tem tempo hoje. Tudo bem: nada é cobrado.' : 'Hoje não é um dia de estudo no seu padrão.')
    : (d.informado ? 'Informado por você.' : 'É o seu tempo padrão. Abra o app para informar o de hoje.')
  const linha = (t: TarefaLembrete) => `${t.titulo} · ${t.duracao_min} min${t.atrasoDias ? ` · ${plural(t.atrasoDias, 'dia', 'dias')} de atraso` : ''}`
  const cortar = (l: string[], max: number) => [...l.slice(0, max), ...(l.length > max ? [`e mais ${l.length - max}`] : [])]
  const para = cortar(d.cabem.map(linha), MAX), depois = cortar(d.depois.map(linha), MAX_DEPOIS)
  const tituloPara = `Para fazer hoje (${formatarMinutos(d.usado)} de ${formatarMinutos(d.minutos)})`, tituloDepois = `Fica para depois (${d.depois.length})`
  const avisos = [
    d.maiorQueOTempo ? 'A primeira tarefa é maior que o tempo informado. Faça o que der.' : '',
    d.atrasadas >= 2 ? `Você tem ${d.atrasadas} tarefas atrasadas. No app, toque em “Reorganizar atrasadas” para distribuí-las pelos próximos dias, dentro do seu tempo.` : '',
    d.erros ? `${plural(d.erros, 'erro do caderno', 'erros do caderno')} para revisar hoje.` : '',
  ].filter(Boolean)

  const html = `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:auto;color:#111;line-height:1.5">
<h2 style="margin:0 0 4px">${esc(saudacao)}</h2><p style="margin:0 0 16px;color:#555">Seu resumo de ${esc(rotulo)}.</p>
<div style="margin:0 0 8px;padding:10px 14px;background:#f3f4f6;border-radius:10px"><b>Tempo de hoje: ${esc(tempoTxt)}</b><br><span style="color:#555;font-size:13px">${esc(tempoNota)}</span></div>
${vazio && !semTempo ? '<p>Nada pendente para hoje. Bom descanso ou bom estudo livre!</p>' : ''}
${para.length ? `<h3 style="margin:18px 0 4px;font-size:16px">${esc(tituloPara)}</h3><ol style="padding-left:22px;margin:6px 0">${para.map(x => `<li style="margin:4px 0">${esc(x)}</li>`).join('')}</ol>` : ''}
${depois.length ? `<h3 style="margin:18px 0 4px;font-size:16px;color:#555">${esc(tituloDepois)}</h3><ul style="padding-left:20px;margin:6px 0;color:#555">${depois.map(x => `<li style="margin:4px 0">${esc(x)}</li>`).join('')}</ul>` : ''}
${avisos.map(a => `<p style="margin-top:14px">${esc(a)}</p>`).join('')}
<p style="margin:24px 0"><a href="${esc(urlApp)}/inicio" style="background:#22C55E;color:#000;padding:12px 20px;border-radius:10px;text-decoration:none;font-weight:bold">Abrir o Residência OS</a></p>
<p style="color:#777;font-size:12px">Para parar de receber este e-mail, desative em Configurações → Lembretes por e-mail.</p></div>`
  const texto = [saudacao, `Seu resumo de ${rotulo}.`, '', `Tempo de hoje: ${tempoTxt}. ${tempoNota}`,
    vazio && !semTempo ? '\nNada pendente para hoje.' : '',
    ...(para.length ? ['', tituloPara, ...para.map((x, i) => (x.startsWith('e mais') ? `  ${x}` : `${i + 1}. ${x}`))] : []),
    ...(depois.length ? ['', tituloDepois, ...depois.map(x => `- ${x}`)] : []),
    ...avisos.flatMap(a => ['', a]), '', `Abrir: ${urlApp}/inicio`, 'Para parar de receber, desative em Configurações → Lembretes por e-mail.'].join('\n')
  return { vazio, assunto, html, texto }
}
