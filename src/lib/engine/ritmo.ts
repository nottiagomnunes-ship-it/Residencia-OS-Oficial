import { addDays, diffDays } from './review'
import { reservaRetaFinal } from './schedule'

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
  const out: Ritmo = { estado: 'ok', ...base, diasAteProva, prazo, necessario, atual: null, status: 'sem_historico', projecao: null, margemDias: null,
    faltaPorSemana: 0, semData: p.semData ?? 0, comData: p.comData ?? 0 }

  const dias = p.primeiraConclusao ? Math.min(JANELA_MAX, diffDays(p.primeiraConclusao, p.hoje) + 1) : 0
  if (dias < HISTORICO_MIN) return out

  const inicio = addDays(p.hoje, -(dias - 1))
  const feitos = p.concluidosRecentes.filter(d => d >= inicio && d <= p.hoje).length
  const atual = feitos / (dias / 7)
  const razao = atual / necessario
  const projecao = atual > 0 ? addDays(p.hoje, Math.ceil(restantes / (atual / 7))) : null
  return {
    ...out, atual, projecao, margemDias: projecao ? diffDays(projecao, prazo) : null, faltaPorSemana: Math.max(0, necessario - atual),
    status: razao >= 1.15 ? 'adiantado' : razao >= 0.9 ? 'no_ritmo' : razao >= 0.6 ? 'um_pouco_atras' : 'atrasado',
  }
}
