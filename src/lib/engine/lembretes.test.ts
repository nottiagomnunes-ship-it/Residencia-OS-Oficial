import { describe, it, expect } from 'vitest'
import { montarDados, montarLembrete, type DadosLembrete, type TarefaLembrete } from './lembretes'

const H = '2026-10-02' // sexta-feira
const T = (titulo: string, min = 30, atrasoDias = 0, tipo = 'estudo'): TarefaLembrete => ({ titulo, tipo, duracao_min: min, atrasoDias })
const base = (o: Partial<DadosLembrete> = {}): DadosLembrete => ({
  nome: 'Tiago Miranda Nunes', hoje: H, minutos: 120, informado: true, cabem: [], depois: [], usado: 0, maiorQueOTempo: false, atrasadas: 0, erros: 0, ...o })
const I = (titulo: string, data: string, duracao_min: number | null = 30, tipo = 'estudo') => ({ titulo, tipo, data, duracao_min })

describe('montarDados: a mesma ordem e a mesma conta do painel Hoje', () => {
  it('atrasadas primeiro (mais antigas antes), depois as de hoje, mantendo a ordem do plano em cada dia', () => {
    const d = montarDados('Ana', H, [I('Hoje A', H), I('Hoje B', H), I('Atraso recente', '2026-10-01'), I('Atraso antigo', '2026-09-29')], 600, true, 0)
    expect(d.cabem.map(t => t.titulo)).toEqual(['Atraso antigo', 'Atraso recente', 'Hoje A', 'Hoje B'])
    expect(d.cabem.map(t => t.atrasoDias)).toEqual([3, 1, 0, 0]); expect(d.atrasadas).toBe(2)
  })
  it('separa o que cabe no tempo de hoje do que fica para depois, na ordem, sem pular para tarefas menores', () => {
    const d = montarDados(null, H, [I('A', H, 60), I('B', H, 45), I('C', H, 15)], 100, true, 0)
    expect(d.cabem.map(t => t.titulo)).toEqual(['A']); expect(d.depois.map(t => t.titulo)).toEqual(['B', 'C']); expect(d.usado).toBe(60)
  })
  it('sem tempo hoje, nada cabe e tudo fica para depois; tarefa sem duração conta 30 min', () => {
    const d = montarDados(null, H, [I('A', H, null)], 0, true, 0)
    expect(d.cabem).toEqual([]); expect(d.depois[0].duracao_min).toBe(30)
  })
  it('se nada cabe, mostra a primeira avisando que é maior que o tempo', () => {
    const d = montarDados(null, H, [I('Grande', H, 90)], 45, true, 0)
    expect(d).toMatchObject({ maiorQueOTempo: true, usado: 90 }); expect(d.cabem.map(t => t.titulo)).toEqual(['Grande'])
  })
})

describe('montarLembrete: assunto', () => {
  it('conta as tarefas de hoje com o tempo, no singular e no plural, e as atrasadas', () => {
    expect(montarLembrete(base({ cabem: [T('A', 60)], usado: 60 }), 'u').assunto).toBe('Residência OS · sexta, 02/10: 1 tarefa para hoje (1 h)')
    expect(montarLembrete(base({ cabem: [T('A', 45), T('B', 45)], usado: 90, atrasadas: 1 }), 'u').assunto).toBe('Residência OS · sexta, 02/10: 2 tarefas para hoje (1 h 30) · 1 atrasada')
    expect(montarLembrete(base({ cabem: [T('A', 30, 2), T('B', 30, 1), T('C')], usado: 90, atrasadas: 2 }), 'u').assunto).toContain('3 tarefas para hoje (1 h 30) · 2 atrasadas')
  })
  it('sem tempo hoje, só erros e nada pendente', () => {
    expect(montarLembrete(base({ minutos: 0, depois: [T('A')] }), 'u').assunto).toBe('Residência OS · sexta, 02/10: sem tempo de estudo hoje')
    expect(montarLembrete(base({ erros: 3 }), 'u').assunto).toBe('Residência OS · sexta, 02/10: 3 erros para revisar')
    expect(montarLembrete(base(), 'u').assunto).toBe('Residência OS · sexta, 02/10: nada pendente')
  })
})

describe('montarLembrete: conteúdo', () => {
  it('"vazio" (o envio automático é pulado) só se não há o que lembrar ou se não há tempo de estudo hoje', () => {
    expect(montarLembrete(base(), 'u').vazio).toBe(true)
    expect(montarLembrete(base({ erros: 1 }), 'u').vazio).toBe(false)
    expect(montarLembrete(base({ cabem: [T('A')], usado: 30 }), 'u').vazio).toBe(false)
    expect(montarLembrete(base({ minutos: 0, informado: false, depois: [T('A')], erros: 2 }), 'u').vazio).toBe(true)   // dia sem estudo: sem e-mail
  })
  it('mostra o tempo de hoje e diz se foi informado ou é o padrão', () => {
    expect(montarLembrete(base({ minutos: 90, informado: true, cabem: [T('A')] }), 'u').texto).toContain('Tempo de hoje: 1 h 30. Informado por você.')
    expect(montarLembrete(base({ minutos: 120, informado: false, cabem: [T('A')] }), 'u').texto).toContain('É o seu tempo padrão. Abra o app para informar o de hoje.')
    expect(montarLembrete(base({ minutos: 0, informado: true, depois: [T('A')] }), 'u').texto).toContain('nada é cobrado')
  })
  it('lista numerada com duração e atraso, e "Fica para depois" separado', () => {
    const t = montarLembrete(base({ cabem: [T('Imunizações', 60, 3), T('Revisão D1 — DM', 30)], usado: 90, depois: [T('30 questões — Pediatria', 60)] }), 'u').texto
    expect(t).toContain('Para fazer hoje (1 h 30 de 2 h)')
    expect(t).toContain('1. Imunizações · 60 min · 3 dias de atraso'); expect(t).toContain('2. Revisão D1 — DM · 30 min')
    expect(t).toContain('Fica para depois (1)'); expect(t).toContain('- 30 questões — Pediatria · 60 min')
    expect(t).not.toMatch(/\d{2}:\d{2} ·/)   // o modelo antigo mostrava horário de relógio: não existe mais
  })
  it('avisos: tarefa maior que o tempo, reorganizar quando há 2 ou mais atrasadas, e erros do caderno', () => {
    expect(montarLembrete(base({ cabem: [T('G', 90)], usado: 90, minutos: 45, maiorQueOTempo: true }), 'u').texto).toContain('maior que o tempo informado')
    expect(montarLembrete(base({ cabem: [T('A', 30, 1), T('B', 30, 2)], usado: 60, atrasadas: 2 }), 'u').texto).toContain('Reorganizar atrasadas')
    expect(montarLembrete(base({ cabem: [T('A', 30, 1)], usado: 30, atrasadas: 1 }), 'u').texto).not.toContain('Reorganizar')
    expect(montarLembrete(base({ cabem: [T('A')], usado: 30, erros: 2 }), 'u').texto).toContain('2 erros do caderno para revisar hoje.')
  })
  it('escapa texto do usuário no HTML (nada de tags ou scripts)', () => {
    const m = montarLembrete(base({ nome: '<b>Eu</b>', cabem: [T('<script>alert(1)</script>')], usado: 30 }), 'https://x.app')
    expect(m.html).not.toContain('<script>'); expect(m.html).toContain('&lt;script&gt;'); expect(m.html).not.toContain('<b>Eu')
  })
  it('listas longas são cortadas com "e mais N"', () => {
    const muitas = Array.from({ length: 12 }, (_, i) => T('T' + i, 10)), m = montarLembrete(base({ minutos: 600, cabem: muitas, usado: 120, depois: muitas.slice(0, 8) }), 'u')
    expect(m.texto).toContain('e mais 4'); expect(m.texto).toContain('e mais 3'); expect(m.texto).not.toContain('T11')
  })
  it('saudação com o primeiro nome e botão para o painel de hoje', () => {
    const m = montarLembrete(base({ cabem: [T('A')], usado: 30 }), 'https://app.exemplo')
    expect(m.texto).toContain('Bom dia, Tiago!'); expect(m.html).toContain('https://app.exemplo/inicio'); expect(m.texto).toContain('Abrir: https://app.exemplo/inicio')
    expect(montarLembrete(base({ nome: null }), 'u').texto).toMatch(/^Bom dia!/)
  })
})
