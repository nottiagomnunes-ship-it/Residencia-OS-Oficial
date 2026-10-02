import { gunzipSync } from 'zlib'

export const LIMITE_ENVIO = 20 * 1024 * 1024          // arquivo enviado (já compactado, se for o caso)
export const LIMITE_DESCOMPACTADO = 80 * 1024 * 1024  // depois de descompactar: protege de arquivo "bomba" (pequeno compactado, gigante aberto)

/**
 * Lê o conteúdo de um arquivo de backup: aceita o .json puro ou compactado (gzip, que o app faz no envio para caber em arquivos grandes).
 * Devolve o objeto lido, ou uma mensagem clara. Não confia em nada: tamanho, compactação e JSON são verificados.
 */
export function lerArquivoDeBackup(bruto: Buffer, limite = LIMITE_DESCOMPACTADO): { ok: true; dados: unknown } | { ok: false; erro: string } {
  let texto: string
  try {
    const compactado = bruto.length > 2 && bruto[0] === 0x1f && bruto[1] === 0x8b
    texto = (compactado ? gunzipSync(bruto, { maxOutputLength: limite }) : bruto).toString('utf8')
  } catch (e: any) {
    return { ok: false, erro: e?.code === 'ERR_BUFFER_TOO_LARGE' ? 'O arquivo é grande demais para restaurar.' : 'O arquivo está corrompido e não pôde ser lido.' }
  }
  if (texto.length > limite) return { ok: false, erro: 'O arquivo é grande demais para restaurar.' }
  try { return { ok: true, dados: JSON.parse(texto.replace(/^\uFEFF/, '')) } } catch { return { ok: false, erro: 'O arquivo não é um JSON válido. Use o arquivo de backup baixado do Residência OS, sem editá-lo.' } }
}
