import { describe, it, expect } from 'vitest'
import { montarDados, montarLembrete, type DadosLembrete } from './lembretes'

const H = '2026-10-02' // sexta-feira
const base = (o: Partial<DadosLembrete> = {}): DadosLembrete => ({ nome: 'Tiago Miranda Nunes', hoje: H, atrasadas: [], revisoesHoje: [], tarefas: [], erros: 0, ...o })

describe('montarDados', () => {
  it('separa atrasadas e de hoje, calcula os dias de atraso e ordena as tarefas por horário', () => {
    const d = montarDados('Ana', H, [
      { due_date: '2026-10-02', interval_days: 7, nome: 'Asma' }, { due_date: '2026-09-29', interval_days: 1, nome: 'DPOC' }, { due_date: '2026-10-01', interval_days: 30, nome: 'HAS' },
    ], [{ titulo: 'Questões', tipo: 'questoes', hora_ini: null }, { titulo: 'Estudo X', tipo: 'estudo', hora_ini: '19:30:00' }, { titulo: 'Estudo Y', tipo: 'estudo', hora_ini: '07:00:00' }], 2)
    expect(d.atrasadas).toEqual([{ nome: 'DPOC', dias: 3, intervalo: 1 }, { nome: 'HAS', dias: 1, intervalo: 30 }])
    expect(d.revisoesHoje).toEqual([{ nome: 'Asma', intervalo: 7 }])
    expect(d.tarefas.map(t => t.titulo)).toEqual(['Estudo Y', 'Estudo X', 'Questões']); expect(d.tarefas[0].ini).toBe('07:00'); expect(d.erros).toBe(2)
  })
})
describe('montarLembrete', () => {
  it('assunto com contagens e atrasadas, no singular e no plural', () => {
    expect(montarLembrete(base({ atrasadas: [{ nome: 'A', dias: 2, intervalo: 1 }], revisoesHoje: [{ nome: 'B', intervalo: 7 }, { nome: 'C', intervalo: 7 }], tarefas: [{ titulo: 'T', tipo: 'estudo', ini: null }] }), 'https://x.app').assunto)
      .toBe('Residência OS · sexta, 02/10: 3 revisões (1 atrasada) e 1 tarefa')
  })
  it('só tarefas, só erros e nada pendente', () => {
    expect(montarLembrete(base({ tarefas: [{ titulo: 'T', tipo: 'estudo', ini: '08:00' }, { titulo: 'U', tipo: 'estudo', ini: null }] }), 'u').assunto).toBe('Residência OS · sexta, 02/10: 2 tarefas')
    expect(montarLembrete(base({ erros: 3 }), 'u').assunto).toBe('Residência OS · sexta, 02/10: 3 erros para revisar')
    const m = montarLembrete(base(), 'u'); expect(m.vazio).toBe(true); expect(m.assunto).toMatch(/nada pendente/); expect(m.html).toMatch(/Nada pendente/)
  })
  it('só não é "vazio" se houver algo', () => { expect(montarLembrete(base({ erros: 1 }), 'u').vazio).toBe(false) })
  it('escapa texto do usuário no HTML (nada de tags ou scripts)', () => {
    const m = montarLembrete(base({ nome: '<b>Ana</b>', revisoesHoje: [{ nome: '<script>alert(1)</script> & cia', intervalo: 1 }] }), 'https://x.app')
    expect(m.html).not.toMatch(/<script>/); expect(m.html).toMatch(/&lt;script&gt;alert\(1\)&lt;\/script&gt; &amp; cia/); expect(m.html).not.toMatch(/<b>Ana/)
  })
  it('listas longas são cortadas com "e mais N"', () => {
    const rev = Array.from({ length: 11 }, (_, i) => ({ nome: 'R' + i, intervalo: 1 }))
    const m = montarLembrete(base({ revisoesHoje: rev }), 'u'); expect(m.texto).toMatch(/e mais 3/); expect(m.texto).toMatch(/R7/); expect(m.texto).not.toMatch(/R8/)
  })
  it('saudação com o primeiro nome e link para o app', () => {
    const m = montarLembrete(base({ erros: 1 }), 'https://meu.app'); expect(m.texto).toMatch(/Bom dia, Tiago!/); expect(m.html).toMatch(/href="https:\/\/meu\.app\/revisoes"/)
  })
})
