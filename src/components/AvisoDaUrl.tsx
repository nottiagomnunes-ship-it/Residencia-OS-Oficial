'use client'
import { useEffect, useRef } from 'react'
import { useAvisos } from '@/components/Avisos'
import { urlSemParametros, type TipoAviso } from '@/lib/engine/avisos'

/**
 * Para as páginas cujas ações voltam com a mensagem na URL (?ok=, ?erro=): mostra o aviso uma vez como aviso temporário e tira os parâmetros do
 * endereço, para atualizar a página (ou voltar a ela) não repetir a mensagem. `chaves` são só os parâmetros que carregam o aviso; os demais ficam.
 */
export default function AvisoDaUrl({ tipo, chaves, children }: { tipo: TipoAviso; chaves: string[]; children: React.ReactNode }) {
  const { mostrar } = useAvisos(), feito = useRef(false)
  useEffect(() => {
    if (feito.current) return
    feito.current = true
    mostrar({ tipo, conteudo: children })
    const atual = window.location.pathname + window.location.search + window.location.hash, limpa = urlSemParametros(window.location.href, chaves)
    if (limpa !== atual) window.history.replaceState(window.history.state, '', limpa)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
