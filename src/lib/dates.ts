const TZ = 'America/Sao_Paulo'
export const hojeBR = () => new Date().toLocaleDateString('sv-SE', { timeZone: TZ })

/** Data (AAAA-MM-DD) e minutos desde 00:00 de um instante, no horário de Brasília. */
export function partesBR(d: Date) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map(x => [x.type, x.value]))
  return { hoje: `${p.year}-${p.month}-${p.day}`, minutos: Number(p.hour) * 60 + Number(p.minute) }
}
/** Minutos desde 00:00, no horário de Brasília. */
export const agoraBR = () => partesBR(new Date()).minutos
