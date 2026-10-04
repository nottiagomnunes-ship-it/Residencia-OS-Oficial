/** No navegador: avisa o servidor de um erro de tela (uma vez por erro nesta aba). Silencioso: falhar aqui não pode atrapalhar. */
const avisados = new Set<string>()
export function avisarErro(error: Error & { digest?: string }) {
  try {
    const chave = `${error.digest ?? ''}|${error.message}`
    if (avisados.has(chave)) return
    avisados.add(chave)
    fetch('/api/erros', {
      method: 'POST', headers: { 'content-type': 'application/json' }, keepalive: true,
      body: JSON.stringify({ mensagem: error.message || 'Erro sem mensagem', digest: error.digest, pagina: location.pathname + location.search, detalhe: error.stack?.slice(0, 3000) }),
    }).catch(() => {})
  } catch { /* nada */ }
}
