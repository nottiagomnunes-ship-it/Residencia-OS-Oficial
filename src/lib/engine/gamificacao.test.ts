import { it, expect } from 'vitest'
import { nivelDoXp, sequencias, desbloqueadas, STATS_ZERO, CONQUISTAS, disciplinaCompleta, assuntoCompleto } from './gamificacao'
import { parseIntervalos } from './config'
import { prioridadeAssunto, recomendacoes } from './desempenho'

it('nível e progresso de XP', () => {
  expect(nivelDoXp(0)).toMatchObject({ nivel: 1, nome: 'Iniciante', pct: 0, xpParaProximo: 500 })
  expect(nivelDoXp(750)).toMatchObject({ nivel: 2, xpNoNivel: 250, pct: 50 })
})
it('sequência não quebra até o fim do dia e conta a melhor', () => {
  expect(sequencias(['2026-09-28', '2026-09-29'], '2026-09-30').atual).toBe(2)
  expect(sequencias(['2026-09-28', '2026-09-30'], '2026-09-30').atual).toBe(1)
  expect(sequencias(['2026-09-20', '2026-09-21', '2026-09-22', '2026-09-28'], '2026-09-30')).toEqual({ atual: 0, melhor: 3 })
  expect(sequencias([], '2026-09-30')).toEqual({ atual: 0, melhor: 0 })
})
it('conquistas por critério', () => {
  const base = STATS_ZERO
  expect(desbloqueadas(base)).toEqual([])
  expect(desbloqueadas({ ...base, questoes: 600, melhorSequencia: 7, conteudos: 1 }).sort()).toEqual(['primeiro_conteudo', 'questoes_100', 'questoes_500', 'sequencia_3', 'sequencia_7'])
})
it('intervalos de revisão', () => {
  expect(parseIntervalos('1, 7 30;60')).toEqual([1, 7, 30, 60]); expect(parseIntervalos('7,1,7')).toEqual([1, 7])
  for (const ruim of ['', '0,5', '1,abc', '1,2,3,4,5,6,7,8,9', '400']) expect(parseIntervalos(ruim)).toBeNull()
})
it('limites de desempenho configuráveis', () => {
  const x = { nome: 'DM', total: 20, acertos: 14, revisoesAtrasadas: 0, errosConteudo: 0 }
  expect(prioridadeAssunto(x).nivel).toBe('baixa')
  expect(prioridadeAssunto(x, { limite: 80, minimo: 5 }).nivel).toBe('media')
  const d = [{ id: 'D', nome: 'Cardio' }], s = [{ discipline_id: 'D', topic_id: null, total: 50, acertos: 35, realizado_em: '2026-09-29' }]
  expect(recomendacoes(s, d)).toHaveLength(0); expect(recomendacoes(s, d, 50, 30, 75)[0].texto).toMatch(/abaixo de 75%/)
})

it('conquistas novas: critérios e códigos únicos', () => {
  expect(new Set(CONQUISTAS.map(c => c.codigo)).size).toBe(CONQUISTAS.length)
  const z = STATS_ZERO, ok = (o: object) => desbloqueadas({ ...z, ...o })
  expect(ok({ etapas: 10 })).toContain('etapas_10'); expect(ok({ erros: 10, errosRevisados: 10 })).toEqual(expect.arrayContaining(['erros_10', 'erros_revisados_10']))
  expect(ok({ simuladoMelhor: 74 })).not.toContain('simulado_75'); expect(ok({ simuladoMelhor: 75 })).toContain('simulado_75')
  expect(ok({ metaBatida: true })).toContain('meta_batida'); expect(ok({ maiorDiaQuestoes: 100, maiorDiaMinutos: 240 })).toEqual(expect.arrayContaining(['maratona_100', 'foco_4h']))
  expect(ok({ questoes: 200, acertoGeral: 79 })).not.toContain('precisao_80'); expect(ok({ questoes: 200, acertoGeral: 80 })).toContain('precisao_80')
  expect(ok({ questoes: 100, acertoGeral: 95 })).not.toContain('precisao_80')
})
it('disciplina e assunto completos exigem mínimo de itens', () => {
  const t = (n: number, ok: number) => Array.from({ length: n }, (_, i) => ({ discipline_id: 'D', status: i < ok ? 'concluido' : 'nao_iniciado' }))
  expect(disciplinaCompleta(t(5, 5))).toBe(true); expect(disciplinaCompleta(t(5, 4))).toBe(false); expect(disciplinaCompleta(t(4, 4))).toBe(false)
  const e = (n: number, ok: number) => Array.from({ length: n }, (_, i) => ({ topic_id: 'T', concluida: i < ok }))
  expect(assuntoCompleto(e(3, 3))).toBe(true); expect(assuntoCompleto(e(3, 2))).toBe(false); expect(assuntoCompleto(e(2, 2))).toBe(false)
})
