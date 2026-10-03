'use client'
import { useCallback } from 'react'
import { useAvisos } from '@/components/Avisos'
import { desfazerMovimento } from '@/lib/calendar'
import { textoDaTarefaMovida } from '@/lib/engine/avisos'
import type { Desfazer } from '@/lib/engine/movimento'

/** Depois de adiar ou mover uma tarefa: avisa para onde ela foi, com "Desfazer" por 8 s. `aoDesfazer` deixa a tela mostrar a tarefa de volta na hora. */
export function useAvisoDeMovimento() {
  const { mostrar } = useAvisos()
  return useCallback((d: Desfazer, aoDesfazer?: () => void) => mostrar({
    tipo: 'ok', conteudo: textoDaTarefaMovida(d.titulo, d.rotulo), duracao: 8000,
    acao: { rotulo: 'Desfazer', fazer: async () => {
      const r = await desfazerMovimento(d)
      if (r.ok) { aoDesfazer?.(); mostrar({ tipo: 'info', conteudo: 'Desfeito.', duracao: 3000 }) }
      else mostrar({ tipo: 'erro', conteudo: r.erro ?? 'Não foi possível desfazer.' })
    } },
  }), [mostrar])
}
