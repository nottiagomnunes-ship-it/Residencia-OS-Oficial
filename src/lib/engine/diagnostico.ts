export type Situacao = { nome: string; estado: 'ok' | 'ausente' | 'atencao'; detalhe: string }

/** Avalia uma variável de ambiente SEM expor o valor: só presença, tamanho e problemas comuns de colagem. */
export function avaliarVariavel(nome: string, valor: string | undefined): Situacao {
  if (valor === undefined) return { nome, estado: 'ausente', detalhe: 'Não encontrada neste ambiente. Crie-a no projeto certo e refaça a publicação.' }
  if (valor === '') return { nome, estado: 'ausente', detalhe: 'Existe, mas está vazia. Edite a variável e cole o valor de novo.' }
  if (valor.trim() !== valor) return { nome, estado: 'atencao', detalhe: 'Tem espaço ou quebra de linha no começo ou no fim. Edite e cole de novo, sem espaços.' }
  if (/^["']|["']$/.test(valor)) return { nome, estado: 'atencao', detalhe: 'Tem aspas no começo ou no fim. Remova as aspas.' }
  if (nome === 'RESEND_API_KEY' && !valor.startsWith('re_')) return { nome, estado: 'atencao', detalhe: 'Não começa com "re_". Confira se copiou a chave do Resend.' }
  if (nome === 'SUPABASE_SERVICE_ROLE_KEY' && !(valor.startsWith('eyJ') || valor.startsWith('sb_secret_'))) return { nome, estado: 'atencao', detalhe: 'Formato inesperado. Use a chave "service_role" (Supabase → Project Settings → API).' }
  if (nome === 'CRON_SECRET' && valor.length < 16) return { nome, estado: 'atencao', detalhe: 'Curto demais. Use um texto aleatório com 20 ou mais caracteres.' }
  return { nome, estado: 'ok', detalhe: `Configurada (${valor.length} caracteres).` }
}

/** Mediana de uma lista de medições (ms), arredondada. */
export const mediana = (xs: number[]) => {
  if (!xs.length) return null
  const o = [...xs].sort((a, b) => a - b), m = Math.floor(o.length / 2)
  return Math.round(o.length % 2 ? o[m] : (o[m - 1] + o[m]) / 2)
}
/** O que o tempo de UMA consulta ao banco (ida e volta, a partir do servidor) quer dizer. Cada página faz algumas, em paralelo. */
export function avaliarLatencia(ms: number | null): { estado: 'ok' | 'atencao' | 'ausente'; detalhe: string } {
  if (ms === null) return { estado: 'ausente', detalhe: 'Não foi possível medir (o banco não respondeu).' }
  if (ms <= 15) return { estado: 'ok', detalhe: 'Servidor e banco estão perto um do outro.' }
  if (ms <= 50) return { estado: 'atencao', detalhe: 'Razoável, mas o servidor e o banco provavelmente estão em regiões diferentes.' }
  return { estado: 'atencao', detalhe: 'Lento: o servidor está longe do banco. Confira a região das funções na Vercel.' }
}
