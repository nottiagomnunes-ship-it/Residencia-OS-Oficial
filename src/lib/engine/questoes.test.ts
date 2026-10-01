import { it, expect } from 'vitest'
import { aproveitamento, estatisticasErros, xpQuestoes } from './questoes'

it('aproveitamento: 42 de 50 = 84%, sem questões = null', () => { expect(aproveitamento(42, 50)).toBe(84); expect(aproveitamento(0, 0)).toBeNull(); expect(aproveitamento(1, 3)).toBe(33) })
it('XP de questões', () => { expect(xpQuestoes(40)).toBe(8); expect(xpQuestoes(4)).toBe(0) })
it('estatística de erros ordena e gera a frase', () => {
  const e = [...Array(5).fill({ motivo: 'falta_conteudo' }), { motivo: 'chute' }, { motivo: 'falta_atencao' }]
  const s = estatisticasErros(e)
  expect(s.total).toBe(7); expect(s.linhas[0]).toEqual({ motivo: 'falta_conteudo', n: 5, pct: 71 })
  expect(s.frase).toBe('71% dos seus erros são por falta de conteúdo.'); expect(s.linhas).toHaveLength(5)
})
it('sem erros não há frase', () => { expect(estatisticasErros([]).frase).toBeNull() })
