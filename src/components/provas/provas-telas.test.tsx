import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: () => {}, push: () => {} }), usePathname: () => '/provas' }))
vi.mock('@/lib/provas', () => ({ responderQuestao: vi.fn(), entregarProva: vi.fn(), classificarErro: vi.fn(), salvarProva: vi.fn() }))
import FazerProva from './FazerProva'
import CorrecaoErros from './CorrecaoErros'
import ImportarProva from './ImportarProva'
import { Enunciado } from './Enunciado'

const texto = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const alts = [{ letra: 'A' as const, texto: 'Primária' }, { letra: 'B' as const, texto: 'Secundária' }, { letra: 'C' as const, texto: 'Terciária' }]
const qs = [1, 2, 3].map(n => ({ id: 'q' + n, numero: n, blocos: [{ tipo: 'texto' as const, texto: `Enunciado ${n}` }], alternativas: alts }))

describe('fazer a prova', () => {
  const html = renderToStaticMarkup(<FazerProva tentativa="t1" nome="UEPA 2022" questoes={qs} tempoInicial={3725} atualInicial={2}
    respostas={{ q2: { alternativa: 'B', chute: true, marcada: true, riscadas: 'C' }, q1: { alternativa: 'A', chute: false, marcada: false, riscadas: '' } }} />)
  it('abre na questão em que parou, com o relógio e o progresso', () => {
    expect(texto(html)).toContain('Questão 2 de 3'); expect(texto(html)).toContain('Enunciado 2'); expect(texto(html)).not.toContain('Enunciado 1')
    expect(texto(html)).toContain('1:02:05'); expect(texto(html)).toContain('2/3')
  })
  it('a alternativa marcada, a riscada, "voltar depois" e "chutei" aparecem como estão salvos', () => {
    expect(html).toMatch(/aria-pressed="true"[^>]*>.{0,400}>B</s)
    expect(html).toContain('aria-label="Desfazer risco da alternativa C"'); expect(html).toContain('line-through')
    expect(texto(html)).toContain('★ Voltar depois'); expect(texto(html)).toContain('✓ Chutei')
  })
  it('a grade mostra todas as questões com estado para leitores de tela', () => {
    expect(html).toContain('aria-label="Questão 1, respondida A"'); expect(html).toContain('aria-label="Questão 2, respondida B, marcada para revisar"')
    expect(html).toContain('aria-label="Questão 3, em branco"')
  })
  it('a última questão troca "Próxima" por "Entregar prova"', () => {
    const h = renderToStaticMarkup(<FazerProva tentativa="t1" nome="P" questoes={qs} tempoInicial={0} atualInicial={3} respostas={{}} />)
    expect(texto(h)).toContain('Entregar prova'); expect(texto(h)).not.toContain('Próxima →')
  })
})

describe('enunciado e correção', () => {
  it('figura com texto alternativo; sem link, um aviso no lugar', () => {
    const h = renderToStaticMarkup(<Enunciado numero={4} blocos={[{ tipo: 'texto', texto: 'Veja' }, { tipo: 'imagem', caminho: 'a', url: 'https://x/a.png' }, { tipo: 'imagem', caminho: 'b', url: null }]} />)
    expect(h).toContain('alt="Figura da questão 4"'); expect(h).toContain('src="https://x/a.png"'); expect(texto(h)).toContain('Figura indisponível')
  })
  it('cada erro: sua resposta × certa, os 5 motivos (o salvo aparece marcado) e a escolha da disciplina', () => {
    const h = renderToStaticMarkup(<CorrecaoErros ds={[{ id: 'd1', nome: 'Pediatria', area: 'pediatria' }]} ts={[]} itens={[
      { erroId: 'e1', numero: 7, situacao: 'errada', chute: false, alternativa: 'C', gabarito: 'B', motivo: 'falta_atencao', alvo: 'd:d1', blocos: [], alternativas: alts },
      { erroId: 'e2', numero: 9, situacao: 'certa', chute: true, alternativa: 'A', gabarito: 'A', motivo: null, alvo: '', blocos: [], alternativas: alts }]} />)
    expect(texto(h)).toContain('Questão 7 Errou'); expect(texto(h)).toContain('Sua: C · Certa: B'); expect(texto(h)).toContain('Questão 9 Acertou no chute')
    expect((h.match(/aria-pressed="true"/g) ?? []).length).toBe(1)
    expect(h).toMatch(/aria-pressed="true"[^>]*>Falta de atenção</)
    expect((h.match(/name="alvo"/g) ?? []).length).toBe(2)
  })
  it('importar: começa só com a escolha do arquivo', () => {
    const h = renderToStaticMarkup(<ImportarProva />)
    expect(h).toContain('accept=".docx'); expect(texto(h)).toContain('Escolher o arquivo da prova (.docx)'); expect(texto(h)).not.toContain('Salvar prova')
  })
})
