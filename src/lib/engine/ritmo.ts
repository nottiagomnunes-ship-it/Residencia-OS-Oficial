import { addDays, diffDays } from './review'
import { reservaRetaFinal } from './schedule'
import { weekStart } from './calendar'

export type StatusRitmo = 'adiantado' | 'no_ritmo' | 'um_pouco_atras' | 'atrasado' | 'sem_historico'
export type Ritmo = {
  estado: 'sem_assuntos' | 'sem_prova' | 'prova_passou' | 'concluido' | 'ok'
  total: number; concluidos: number; restantes: number
  diasAteProva?: number
  prazo?: string               // último dia do estudo novo (depois vêm os dias de questões e simulados)
  necessario?: number          // assuntos por semana para terminar no prazo
  atual?: number | null        // assuntos por semana nas últimas semanas (null: pouco histórico)
  status?: StatusRitmo
  projecao?: string | null     // quando termina, se mantiver o ritmo atual
  margemDias?: number | null   // positivo: termina antes do prazo; negativo: depois
  faltaPorSemana?: number      // quanto falta no ritmo para alcançar o necessário
  semData?: number; comData?: number   // assuntos sem/com data no plano atual
  metaSemana?: number | null   // sugestão pequena para esta semana (null enquanto não há histórico para medir)
  feitosSemana?: number        // assuntos concluídos desde segunda-feira
}

const HISTORICO_MIN = 7, JANELA_MAX = 28

/**
 * Compara o seu ritmo (assuntos concluídos por semana) com o necessário para terminar o estudo novo antes da reta final.
 * O ritmo mede a janela que existe de histórico, de 7 a 28 dias, a contar do primeiro assunto concluído, para não subestimar quem começou há pouco.
 */
export function calcularRitmo(p: {
  hoje: string; prova: string | null; total: number; concluidos: number
  primeiraConclusao: string | null; concluidosRecentes: string[]; semData?: number; comData?: number
}): Ritmo {
  const restantes = Math.max(0, p.total - p.concluidos)
  const base = { total: p.total, concluidos: p.concluidos, restantes }
  if (p.total <= 0) return { estado: 'sem_assuntos', ...base }
  if (!p.prova) return { estado: 'sem_prova', ...base }
  const diasAteProva = diffDays(p.hoje, p.prova)
  if (diasAteProva <= 0) return { estado: 'prova_passou', ...base, diasAteProva }
  if (restantes === 0) return { estado: 'concluido', ...base, diasAteProva }

  // mesma conta do gerador: o estudo vai até a véspera da prova menos a reserva da reta final
  const nDias = diasAteProva, reserva = reservaRetaFinal(nDias), diasAtePrazo = Math.max(1, nDias - reserva)
  const prazo = addDays(p.hoje, diasAtePrazo - 1)
  const necessario = restantes / (diasAtePrazo / 7)
  const feitosSemana = p.concluidosRecentes.filter(d => d >= weekStart(p.hoje) && d <= p.hoje).length
  const out: Ritmo = { estado: 'ok', ...base, diasAteProva, prazo, necessario, atual: null, status: 'sem_historico', projecao: null, margemDias: null,
    faltaPorSemana: 0, semData: p.semData ?? 0, comData: p.comData ?? 0, metaSemana: null, feitosSemana }

  const dias = p.primeiraConclusao ? Math.min(JANELA_MAX, diffDays(p.primeiraConclusao, p.hoje) + 1) : 0
  if (dias < HISTORICO_MIN) return out

  const inicio = addDays(p.hoje, -(dias - 1))
  const feitos = p.concluidosRecentes.filter(d => d >= inicio && d <= p.hoje).length
  const atual = feitos / (dias / 7)
  const razao = atual / necessario
  const projecao = atual > 0 ? addDays(p.hoje, Math.ceil(restantes / (atual / 7))) : null
  const status: StatusRitmo = razao >= 1.15 ? 'adiantado' : razao >= 0.9 ? 'no_ritmo' : razao >= 0.6 ? 'um_pouco_atras' : 'atrasado'
  // meta da semana: quem está bem mantém o passo necessário; quem está atrás recebe um degrau pequeno (o ritmo recente + 1), nunca o déficit inteiro
  const meta = status === 'adiantado' || status === 'no_ritmo' ? Math.ceil(necessario) : Math.min(Math.ceil(necessario), Math.max(1, Math.ceil(atual) + 1))
  return {
    ...out, atual, projecao, margemDias: projecao ? diffDays(projecao, prazo) : null, faltaPorSemana: Math.max(0, necessario - atual),
    status, metaSemana: Math.max(1, Math.min(meta, restantes)),
  }
}

export type Tom = 'bom' | 'ajuste' | 'neutro'
const dm = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}`
const dma = (d: string) => `${d.slice(8)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
const dias = (n: number) => `${n} ${n === 1 ? 'dia' : 'dias'}`
const LIMITE_PROJECAO = 30   // acima de ~1 mês de diferença a projeção deixa de ser confiável (e de ajudar): não mostra a data

/**
 * Como dizer o ritmo sem alarme: rótulos neutros, a data só quando está perto do prazo (diferenças grandes viram um passo pequeno)
 * e nada de "atraso" em dias. `frase` é a projeção (ou null); `passo` é a sugestão pequena para quem está abaixo do necessário.
 */
export function descreverRitmo(r: Ritmo): { rotulo: string; tom: Tom; frase: string | null; passo: string | null } {
  const status = r.status ?? 'sem_historico'
  const rotulo = { adiantado: ['Com folga', 'bom'], no_ritmo: ['No caminho', 'bom'], um_pouco_atras: ['Dá para acelerar', 'ajuste'], atrasado: ['Precisa de ajuste', 'ajuste'], sem_historico: ['Medindo o seu ritmo', 'neutro'] }[status] as [string, Tom]
  const m = r.margemDias
  let frase: string | null
  if (status === 'sem_historico') frase = 'Conclua assuntos por mais alguns dias para o app medir o seu ritmo.'
  else if (r.projecao == null) frase = 'Ainda não há assuntos concluídos nas últimas semanas, então não há projeção. Um bom primeiro passo é concluir 1 assunto esta semana.'
  else if (m! >= 7) frase = m! <= LIMITE_PROJECAO ? `No ritmo atual você termina em ${dma(r.projecao)}, ${dias(m!)} antes do prazo.` : 'No ritmo atual você termina bem antes do prazo.'
  else if (m! >= -3) frase = `No ritmo atual você termina por volta do prazo (${dm(r.projecao)}).`
  else frase = m! >= -LIMITE_PROJECAO ? `No ritmo atual você terminaria em ${dma(r.projecao)}, ${dias(-m!)} depois do prazo.` : null
  // sem nenhuma conclusão recente a frase já convida a um primeiro passo: não repete a sugestão
  const passo = (status === 'um_pouco_atras' || status === 'atrasado') && (r.atual ?? 0) > 0 ? 'Um passo pequeno: mais 1 assunto por semana já aproxima você do ritmo necessário.' : null
  return { rotulo: rotulo[0], tom: rotulo[1], frase, passo }
}
