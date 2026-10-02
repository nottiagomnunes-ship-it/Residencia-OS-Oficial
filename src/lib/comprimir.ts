/** Compacta um arquivo no navegador (gzip) para caber nos limites de envio. Sem suporte do navegador, devolve o original. */
export async function comprimirParaEnvio(arquivo: File): Promise<Blob> {
  if (typeof CompressionStream === 'undefined' || arquivo.size < 256 * 1024) return arquivo
  try { return await new Response(arquivo.stream().pipeThrough(new CompressionStream('gzip'))).blob() } catch { return arquivo }
}
/** Acima disso o envio é recusado pela hospedagem (limite de ~4,5 MB por pedido), então avisamos antes de tentar. */
export const LIMITE_PEDIDO_BYTES = 4 * 1024 * 1024
