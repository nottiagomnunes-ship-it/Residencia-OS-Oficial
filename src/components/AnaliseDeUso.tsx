'use client'
import { Analytics } from '@vercel/analytics/next'
import { SpeedInsights } from '@vercel/speed-insights/next'
import { limparEvento } from '@/lib/engine/analise'

/**
 * Análise de uso anônima (Vercel): contagem de visitas e páginas abertas (Analytics) e tempo de carregamento
 * (Speed Insights). Sem cookies e sem e-mail ou id de conta: o endereço sai sem "?…"/"#…" e com os ids mascarados.
 * Só envia em produção na Vercel (em desenvolvimento os componentes não mandam nada).
 */
export default function AnaliseDeUso() {
  return <><Analytics beforeSend={limparEvento} /><SpeedInsights beforeSend={limparEvento} /></>
}
