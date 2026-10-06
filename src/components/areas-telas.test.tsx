import { describe, it, expect } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DisciplinasPorArea, DisciplinasSimples, type CartaoDisciplina } from './DisciplinasPorArea'
import { ResumoPorArea } from './ResumoPorArea'
import { AlvoSelect } from './AlvoSelect'
import { agruparPorArea, resumoPorArea, areaDeMenorAcerto, COR_AREA } from '@/lib/engine/areas'

const texto = (h: string) => h.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
const c = (id: string, nome: string, area: any, ok = 0, total = 0): CartaoDisciplina => ({ id, nome, cor: '#22C55E', peso: 3, ok, total, area })
const cartoes = [c('a', 'Cardiologia', 'clinica', 8, 20), c('b', 'Nefrologia', 'clinica', 2, 10), c('c', 'Trauma', 'cirurgia', 0, 12), c('d', 'Pediatria', 'pediatria', 5, 5), c('e', 'Anatomia', null, 0, 4)]

describe('Disciplinas agrupadas por área', () => {
  const html = renderToStaticMarkup(<DisciplinasPorArea grupos={agruparPorArea(cartoes)} />)
  it('um bloco por área, na ordem da prova, e "Sem área" por último', () => {
    const titulos = [...html.matchAll(/<h2[^>]*>([^<]+)<\/h2>/g)].map(m => m[1]); expect(titulos).toEqual(['Clínica Médica', 'Cirurgia', 'Pediatria', 'Sem área'])
  })
  it('Cardiologia e Nefrologia aparecem dentro de Clínica Médica, cada uma com o seu cartão e o seu link', () => {
    const clinica = html.split('<section').find(s => s.includes('aria-label="Clínica Médica"'))!; expect(clinica).toContain('Cardiologia'); expect(clinica).toContain('Nefrologia'); expect(clinica).not.toContain('Trauma')
    expect(clinica).toContain('href="/disciplinas/a"'); expect(clinica).toContain('href="/disciplinas/b"')
  })
  it('cada bloco resume o progresso dos assuntos da área', () => { expect(texto(html)).toContain('2 disciplinas · 10 de 30 assuntos concluídos (33%)'); expect(texto(html)).toContain('1 disciplina · 5 de 5 assuntos concluídos (100%)') })
  it('a cor do ponto de cada área é a dela; "Sem área" fica cinza', () => {
    for (const [a, cor] of Object.entries(COR_AREA)) if (a !== 'go' && a !== 'preventiva') expect(html).toContain(`background:${cor}`); expect(html).toContain('background:var(--c-muted)')
  })
  it('o cartão da disciplina mantém o que já tinha (peso, progresso)', () => { expect(texto(html)).toContain('peso 3'); expect(texto(html)).toContain('8/20 conteúdos concluídos · 40%') })
  it('sem assuntos, o bloco não mostra um percentual sem sentido', () => { const h = renderToStaticMarkup(<DisciplinasPorArea grupos={agruparPorArea([c('x', 'Obstetrícia', 'go', 0, 0)])} />); expect(texto(h)).toContain('1 disciplina'); expect(texto(h)).not.toContain('assuntos concluídos') })
  it('sem áreas disponíveis, a grade simples de antes', () => { const h = renderToStaticMarkup(<DisciplinasSimples itens={cartoes} />); expect(h).not.toContain('<h2'); expect(h.match(/href="\/disciplinas\//g)!.length).toBe(5) })
})

describe('Desempenho por área', () => {
  const resumos = resumoPorArea([{ area: 'clinica', total: 200, acertos: 160 }, { area: 'cirurgia', total: 100, acertos: 55 }, { area: 'pediatria', total: 10, acertos: 9 }, { area: null, total: 50, acertos: 25 }])
  it('mostra as 5 áreas (e "Sem área" se houver questões), com aproveitamento, questões e disciplinas', () => {
    const t = texto(renderToStaticMarkup(<ResumoPorArea resumos={resumos} menor={areaDeMenorAcerto(resumos)} nenhumaOrganizada={false} />))
    for (const r of ['Clínica Médica', 'Cirurgia', 'Pediatria', 'Ginecologia e Obstetrícia', 'Preventiva', 'Sem área']) expect(t).toContain(r)
    expect(t).toContain('80%'); expect(t).toContain('55%'); expect(t).toContain('200 questões'); expect(t).toContain('sem questões ainda')
  })
  it('aponta a área de menor aproveitamento em tom neutro, sem alarme', () => {
    const t = texto(renderToStaticMarkup(<ResumoPorArea resumos={resumos} menor={areaDeMenorAcerto(resumos)} nenhumaOrganizada={false} />))
    expect(t).toContain('Menor aproveitamento até agora: Cirurgia (55%)'); expect(t).toContain('Uma boa área para dar mais atenção'); expect(t).not.toMatch(/atrasad|péssim|ruim|alerta|urgente/i)
  })
  it('sem menor área (poucos dados), não inventa uma', () => { expect(texto(renderToStaticMarkup(<ResumoPorArea resumos={resumoPorArea([])} menor={null} nenhumaOrganizada={false} />))).not.toContain('Menor aproveitamento') })
  it('nenhuma disciplina organizada: convida a organizar, com link, em vez de mostrar números vazios', () => {
    const h = renderToStaticMarkup(<ResumoPorArea resumos={resumoPorArea([])} menor={null} nenhumaOrganizada />); expect(texto(h)).toContain('organize as disciplinas por área'); expect(h).toContain('href="/disciplinas"'); expect(texto(h)).not.toContain('sem questões ainda')
  })
  it('"Sem área" não é uma área da prova: o número e a barra ficam cinza, mesmo com aproveitamento baixo', () => {
    const h = renderToStaticMarkup(<ResumoPorArea resumos={resumoPorArea([{ area: null, total: 100, acertos: 40 }, { area: 'clinica', total: 100, acertos: 40 }])} menor={null} nenhumaOrganizada={false} />)
    const cartao = (nome: string) => h.split('<div class="space-y-2 rounded-2xl').find(c => c.includes(nome))!
    expect(cartao('Sem área')).not.toContain('var(--c-danger)'); expect(cartao('Sem área')).toContain('color:var(--c-muted)'); expect(cartao('Clínica Médica')).toContain('var(--c-danger)')   // uma área de verdade segue as faixas de sempre
  })
  it('a grade fecha em 3 colunas (3+2 ou 3+3), sem um card sozinho na última linha', () => { expect(renderToStaticMarkup(<ResumoPorArea resumos={resumoPorArea([])} menor={null} nenhumaOrganizada={false} />)).toContain('lg:grid-cols-3') })
  it('a cor do ponto de cada área nunca é vermelho de alerta', () => { expect(renderToStaticMarkup(<ResumoPorArea resumos={resumoPorArea([{ area: 'clinica', total: 100, acertos: 90 }])} menor={null} nenhumaOrganizada={false} />)).not.toMatch(/background:#EF4444"?><\/span>/) })
})

describe('lista de escolha de disciplina/assunto', () => {
  const ds = [{ id: 'g', nome: 'Obstetrícia', area: 'go' }, { id: 'c', nome: 'Cardiologia', area: 'clinica' }, { id: 'x', nome: 'Anatomia', area: null }, { id: 't', nome: 'Trauma', area: 'cirurgia' }, { id: 'p', nome: 'Pediatria', area: 'pediatria' }]
  const ts = [{ id: 'h', nome: 'HAS', discipline_id: 'c' }]
  const html = renderToStaticMarkup(<AlvoSelect ds={ds} ts={ts} />)
  it('as disciplinas vêm na ordem das áreas, com a área na frente, e as sem área por último', () => {
    expect([...html.matchAll(/<optgroup label="([^"]+)"/g)].map(m => m[1])).toEqual(['Clínica · Cardiologia', 'Cirurgia · Trauma', 'Pediatria', 'GO · Obstetrícia', 'Anatomia'])
  })
  it('os valores das opções não mudaram (o resto do app continua entendendo a escolha)', () => { expect(html).toContain('value="d:c"'); expect(html).toContain('value="t:h"'); expect(html).toContain('Cardiologia (geral)') })
  it('sem área em nenhuma disciplina (ou campo ausente), a lista é como era', () => {
    const h = renderToStaticMarkup(<AlvoSelect ds={[{ id: 'a', nome: 'Alfa' }, { id: 'b', nome: 'Beta' }]} ts={[]} />); expect([...h.matchAll(/<optgroup label="([^"]+)"/g)].map(m => m[1])).toEqual(['Alfa', 'Beta'])
  })
  it('um valor de área inválido vindo do banco é tratado como "sem área"', () => { const h = renderToStaticMarkup(<AlvoSelect ds={[{ id: 'a', nome: 'Alfa', area: 'inventada' }]} ts={[]} />); expect(h).toContain('label="Alfa"') })
})
