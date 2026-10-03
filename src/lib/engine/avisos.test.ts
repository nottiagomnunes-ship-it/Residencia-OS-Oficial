import { describe, it, expect } from 'vitest'
import { duracaoDoAviso, adicionarAviso, rotuloDoDia, textoDaTarefaMovida, urlSemParametros, DURACAO_MS, MAX_AVISOS } from './avisos'

describe('duração dos avisos', () => {
  it('sucesso e informação somem em 6 s; erro fica 15 s', () => { expect([duracaoDoAviso('ok', false), duracaoDoAviso('info', false), duracaoDoAviso('erro', false)]).toEqual([6000, 6000, 15000]) })
  it('com botão de ação (Desfazer) dá tempo de tocar: pelo menos 8 s, e erro com ação não encurta', () => {
    expect(duracaoDoAviso('ok', true)).toBe(8000); expect(duracaoDoAviso('info', true)).toBe(8000); expect(duracaoDoAviso('erro', true)).toBe(DURACAO_MS.erro)
  })
  it('a duração informada manda; null = não some sozinho', () => { expect(duracaoDoAviso('ok', false, 3000)).toBe(3000); expect(duracaoDoAviso('erro', true, null)).toBeNull() })
})

describe('limite de avisos na tela', () => {
  it('no máximo 3: entram os novos e saem os mais antigos', () => {
    expect(MAX_AVISOS).toBe(3); expect(adicionarAviso([1, 2], 3)).toEqual([1, 2, 3]); expect(adicionarAviso([1, 2, 3], 4)).toEqual([2, 3, 4]); expect(adicionarAviso([], 1)).toEqual([1])
  })
  it('não altera a lista original', () => { const l = [1, 2, 3]; adicionarAviso(l, 4); expect(l).toEqual([1, 2, 3]) })
})

describe('dia por extenso', () => {
  const hoje = '2026-10-05'   // segunda
  it('hoje, amanhã e ontem; os demais pelo dia da semana', () => {
    expect(rotuloDoDia('2026-10-05', hoje)).toBe('hoje'); expect(rotuloDoDia('2026-10-06', hoje)).toBe('amanhã'); expect(rotuloDoDia('2026-10-04', hoje)).toBe('ontem')
    expect(rotuloDoDia('2026-10-08', hoje)).toBe('quinta, 08/10'); expect(rotuloDoDia('2026-10-10', hoje)).toBe('sábado, 10/10'); expect(rotuloDoDia('2026-10-11', hoje)).toBe('domingo, 11/10')
  })
  it('vira o mês e o ano sem errar', () => { expect(rotuloDoDia('2026-11-01', '2026-10-31')).toBe('amanhã'); expect(rotuloDoDia('2027-01-01', '2026-12-31')).toBe('amanhã'); expect(rotuloDoDia('2026-12-31', '2027-01-01')).toBe('ontem') })
})

describe('frase de tarefa movida', () => {
  it('curta e clara', () => { expect(textoDaTarefaMovida('Imunizações', 'amanhã')).toBe('Movida para amanhã: Imunizações') })
  it('título muito longo é cortado com reticências', () => {
    const t = textoDaTarefaMovida('Revisão D1 — DM — Classificação, Diagnóstico e Metas de Controle Glicêmico (Parte 1)', 'quinta, 08/10'); expect(t.endsWith('…')).toBe(true); expect(t.length).toBeLessThan(90)
  })
})

describe('limpar o aviso da URL', () => {
  it('tira só os parâmetros do aviso, mantendo os demais e o trecho #', () => {
    expect(urlSemParametros('/questoes?ok=40-32&xp=25&etapas=1&alvo=t:abc', ['ok', 'xp', 'etapas'])).toBe('/questoes?alvo=t%3Aabc')
    expect(urlSemParametros('/configuracoes?ok=1#aparencia', ['ok'])).toBe('/configuracoes#aparencia')
  })
  it('sem parâmetros restantes, fica só o caminho', () => { expect(urlSemParametros('/simulados?erro=Confira', ['erro'])).toBe('/simulados') })
  it('endereço completo ou parâmetro que não existe também funcionam', () => { expect(urlSemParametros('https://x.app/inicio?ok=1', ['ok'])).toBe('/inicio'); expect(urlSemParametros('/inicio', ['ok'])).toBe('/inicio') })
  it('texto com acentos e símbolos na mensagem não atrapalha', () => { expect(urlSemParametros('/configuracoes?erro=Para%20reiniciar%2C%20digite%20REINICIAR&x=1', ['erro'])).toBe('/configuracoes?x=1') })
})
