import { it, expect } from 'vitest'
import { aproveitamento, estatisticasErros, xpQuestoes, resumoQuestoes } from './questoes'

it('aproveitamento: 42 de 50 = 84%, sem questões = null', () => { expect(aproveitamento(42, 50)).toBe(84); expect(aproveitamento(0, 0)).toBeNull(); expect(aproveitamento(1, 3)).toBe(33) })
it('XP de questões', () => { expect(xpQuestoes(40)).toBe(8); expect(xpQuestoes(4)).toBe(0) })
it('estatística de erros ordena e gera a frase', () => {
  const e = [...Array(5).fill({ motivo: 'falta_conteudo' }), { motivo: 'chute' }, { motivo: 'falta_atencao' }]
  const s = estatisticasErros(e)
  expect(s.total).toBe(7); expect(s.linhas[0]).toEqual({ motivo: 'falta_conteudo', n: 5, pct: 71 })
  expect(s.frase).toBe('71% dos seus erros são por falta de conteúdo.'); expect(s.linhas).toHaveLength(5)
})
it('sem erros não há frase', () => { expect(estatisticasErros([]).frase).toBeNull() })

it('resumo ao vivo: erros e aproveitamento', () => {
  expect(resumoQuestoes('50', '42')).toEqual({ valido: true, mensagem: '8 erros · 84% de aproveitamento', tipo: 'bom' })
  expect(resumoQuestoes('10', '9')).toMatchObject({ mensagem: '1 erro · 90% de aproveitamento' })
  expect(resumoQuestoes('20', '13')).toMatchObject({ tipo: 'medio' }); expect(resumoQuestoes('20', '10')).toMatchObject({ tipo: 'baixo' })
})
it('resumo ao vivo: valores incompletos ou impossíveis não liberam o registro', () => {
  expect(resumoQuestoes('', '5')).toMatchObject({ valido: false, mensagem: null }); expect(resumoQuestoes('30', '')).toMatchObject({ valido: false })
  expect(resumoQuestoes('0', '0')).toMatchObject({ valido: false }); expect(resumoQuestoes('3.5', '2')).toMatchObject({ valido: false })
  expect(resumoQuestoes('30', '31')).toMatchObject({ valido: false, tipo: 'erro', mensagem: 'Os acertos (31) não podem passar do total (30).' })
  expect(resumoQuestoes('30', '30')).toMatchObject({ valido: true, mensagem: '0 erros · 100% de aproveitamento' })
})
