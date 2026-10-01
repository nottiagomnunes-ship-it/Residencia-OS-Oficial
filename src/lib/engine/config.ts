/** "1, 7 30;60" → [1, 7, 30, 60]. Inválido (vazio, fora de 1–365, mais de 8) → null. */
export function parseIntervalos(texto: string): number[] | null {
  const n = texto.split(/[,\s;]+/).filter(Boolean).map(Number)
  if (!n.length || n.length > 8 || n.some(x => !Number.isInteger(x) || x < 1 || x > 365)) return null
  return [...new Set(n)].sort((a, b) => a - b)
}

/** Valores padrão das configurações do perfil (os mesmos das migrações). Usados ao reiniciar as configurações. */
export const CONFIG_PADRAO = {
  exam_date: null as string | null, daily_minutes: 240, daily_questions_goal: 40, available_weekdays: [1, 2, 3, 4, 5, 6],
  review_intervals: [1, 7, 30, 60], adaptive_reviews: true, limite_foco: 65, min_questoes: 10,
  janela_ini: '06:00', janela_fim: '23:00', folga_min: 30,
}
