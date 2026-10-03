import { describe, it, expect } from 'vitest'
import { validarCompromisso, copiarEscala, livreDoDia, descreverJanelas, horaCurta, duracaoCurta, janelaDoPerfil, quando, corDaCategoria, CATEGORIAS, MODELOS } from './agenda'
import { ocupadosPorData, paraCompromisso } from './compromissos'

describe('validar o que entra na agenda', () => {
  const base = { titulo: ' Academia ', categoria: 'academia', tipo: 'semanal', dias: ['1', '3', '5', '9', '3'], hora_ini: '18:00', hora_fim: '19:00:00' }
  it('toda semana: limpa dias e horário; ignora data', () => {
    expect(validarCompromisso({ ...base, data: '2026-10-07', valido_de: '2026-10-05' })).toEqual({ ok: true, c: { titulo: 'Academia', categoria: 'academia', tipo: 'semanal', dias: [1, 3, 5], data: null,
      hora_ini: '18:00', hora_fim: '19:00', valido_de: '2026-10-05', valido_ate: null } })
  })
  it('só um dia: precisa de data e não guarda dias nem validade; plantão que vira a noite é aceito', () => {
    const r = validarCompromisso({ titulo: 'Plantão', categoria: 'x', tipo: 'pontual', data: '2026-10-07', dias: [1], hora_ini: '19:00', hora_fim: '07:00', valido_de: '2026-10-01' })
    expect(r).toEqual({ ok: true, c: { titulo: 'Plantão', categoria: 'outro', tipo: 'pontual', dias: [], data: '2026-10-07', hora_ini: '19:00', hora_fim: '07:00', valido_de: null, valido_ate: null } })
  })
  it('recusa com mensagem clara', () => {
    const erro = (o: object) => { const r = validarCompromisso({ ...base, ...o }); return r.ok ? null : r.erro }
    expect(erro({ titulo: '  ' })).toMatch(/nome/); expect(erro({ hora_ini: '25:00' })).toMatch(/horário/); expect(erro({ hora_fim: '18:00' })).toMatch(/iguais/)
    expect(erro({ dias: [] })).toMatch(/dia da semana/); expect(erro({ tipo: 'pontual', data: '' })).toMatch(/data/)
    expect(erro({ valido_de: '2026-10-10', valido_ate: '2026-10-01' })).toMatch(/depois/)
  })
  it('os atalhos são válidos (com uma data para os de um dia só)', () => {
    for (const m of MODELOS) expect(validarCompromisso({ ...m, titulo: m.titulo || 'Dentista', hora_ini: m.ini, hora_fim: m.fim, data: '2026-10-07' }).ok).toBe(true)
  })
})

describe('copiar a escala da semana anterior', () => {
  const p = (data: string, titulo = 'Plantão', ini = '19:00:00', fim = '07:00:00') => ({ titulo, categoria: 'plantao', tipo: 'pontual', data, hora_ini: ini, hora_fim: fim })
  it('leva os de um dia só para o mesmo dia da semana seguinte, sem duplicar e sem tocar nos semanais', () => {
    const todos = [p('2026-09-29'), p('2026-10-02', 'Enfermaria', '07:00:00', '13:00:00'), p('2026-09-27'), p('2026-10-09'),
      { ...p('2026-10-01'), tipo: 'semanal' }, p('2026-10-06')] // 06/10 já tem o plantão de 29/09 copiado
    expect(copiarEscala(todos, '2026-10-05')).toEqual([{ titulo: 'Enfermaria', categoria: 'plantao', tipo: 'pontual', dias: [], data: '2026-10-09', hora_ini: '07:00', hora_fim: '13:00', valido_de: null, valido_ate: null }])
  })
})

describe('tempo livre do dia', () => {
  const C = (o: object) => paraCompromisso({ titulo: 'X', tipo: 'semanal', dias: [1], hora_ini: '07:00:00', hora_fim: '13:00:00', ...o })
  it('janela menos a agenda, com folga; plantão da noite anterior ocupa a manhã', () => {
    const oc = ocupadosPorData([C({}), C({ hora_ini: '18:00:00', hora_fim: '19:00:00', categoria: 'academia', id: 'a1' }), C({ tipo: 'pontual', dias: [], data: '2026-10-04', hora_ini: '19:00:00', hora_fim: '07:00:00' })], '2026-10-04', '2026-10-05')
    expect(oc['2026-10-05'].find(o => o.id === 'a1')).toEqual({ ini: 1080, fim: 1140, titulo: 'X', id: 'a1', categoria: 'academia' })
    const l = livreDoDia(oc['2026-10-05'], { ini: 360, fim: 1380 }, 30)
    expect(l.janelas).toEqual([[810, 1050], [1170, 1380]]); expect(l.minutos).toBe(450)
    expect(descreverJanelas(l.janelas)).toBe('13h30–17h30 e 19h30–23h')
    expect(livreDoDia([], { ini: 360, fim: 1380 }, 30).minutos).toBe(1020)
  })
  it('textos curtos', () => {
    expect(horaCurta(840)).toBe('14h'); expect(horaCurta(1445 - 5)).toBe('24h'); expect(duracaoCurta(45)).toBe('45 min'); expect(duracaoCurta(330)).toBe('5h30')
    expect(descreverJanelas([])).toBe(''); expect(descreverJanelas([[60, 120], [180, 240], [300, 360]])).toBe('1h–2h, 3h–4h e 5h–6h')
  })
  it('janela do perfil com padrão seguro', () => {
    expect(janelaDoPerfil('07:00:00', '22:30:00')).toEqual({ ini: 420, fim: 1350 }); expect(janelaDoPerfil(null, undefined)).toEqual({ ini: 360, fim: 1380 })
    expect(janelaDoPerfil('23:00', '06:00')).toEqual({ ini: 360, fim: 1380 })
  })
})

describe('rótulos', () => {
  it('quando repete', () => {
    expect(quando({ tipo: 'semanal', dias: [5, 1, 3], data: null, valido_de: '2026-10-06', valido_ate: null })).toBe('Seg, Qua e Sex · desde 06/10')
    expect(quando({ tipo: 'semanal', dias: [0, 1, 2, 3, 4, 5, 6], data: null, valido_de: null, valido_ate: '2026-12-20' })).toBe('Todos os dias · até 20/12')
    expect(quando({ tipo: 'pontual', dias: [], data: '2026-10-07', valido_de: null, valido_ate: null })).toBe('Só em 07/10')
  })
  it('cor por categoria; desconhecida fica cinza; nenhuma usa o verde do estudo nem o vermelho de atraso', () => {
    expect(corDaCategoria('academia')).toBe(CATEGORIAS.academia.cor); expect(corDaCategoria('xyz')).toBe(CATEGORIAS.outro.cor)
    for (const c of Object.values(CATEGORIAS)) { expect(c.cor).not.toBe('#22C55E'); expect(c.cor).not.toBe('#EF4444') }
  })
})

describe('sugestão de tempo de estudo', () => {
  it('metade do livre, arredondada para baixo nas opções, no máximo 4h', async () => {
    const { sugestaoDeEstudo } = await import('./agenda')
    expect(sugestaoDeEstudo(300)).toBe(120)   // 5h livres → 2h
    expect(sugestaoDeEstudo(450)).toBe(180)   // 7h30 → 3h
    expect(sugestaoDeEstudo(1020)).toBe(240)  // dia todo → 4h
    expect(sugestaoDeEstudo(50)).toBe(30); expect(sugestaoDeEstudo(30)).toBe(0); expect(sugestaoDeEstudo(0)).toBe(0)
  })
})

describe('texto rápido da escala', () => {
  const seg = '2026-10-05'
  it('dias, intervalos, listas, datas, horas em vários formatos e o tipo pelo nome', async () => {
    const { lerEscalaEmTexto } = await import('./agenda')
    const r = lerEscalaEmTexto('seg 7-13 Enfermaria; ter 19h–7h PS\nqua a sex 7h às 13h Ambulatório\nseg, qua e sex 18-19 academia\n14/10 14h30-15h Dentista\nsábado 8:00-12:00 Aula do cursinho', seg)
    expect(r.erros).toEqual([])
    expect(r.itens.map(i => `${i.data} ${i.hora_ini}-${i.hora_fim} ${i.titulo} [${i.categoria}]`)).toEqual([
      '2026-10-05 07:00-13:00 Enfermaria [internato]', '2026-10-06 19:00-07:00 PS [plantao]',
      '2026-10-07 07:00-13:00 Ambulatório [internato]', '2026-10-08 07:00-13:00 Ambulatório [internato]', '2026-10-09 07:00-13:00 Ambulatório [internato]',
      '2026-10-05 18:00-19:00 academia [academia]', '2026-10-07 18:00-19:00 academia [academia]', '2026-10-09 18:00-19:00 academia [academia]',
      '2026-10-14 14:30-15:00 Dentista [compromisso]', '2026-10-10 08:00-12:00 Aula do cursinho [aula]'])
  })
  it('sex a seg atravessa o fim de semana; segunda-feira por extenso; data de janeiro numa semana de dezembro vai para o ano seguinte', async () => {
    const { lerEscalaEmTexto } = await import('./agenda')
    expect(lerEscalaEmTexto('sex a seg 7-19 Plantão', seg).itens.map(i => i.data)).toEqual(['2026-10-05', '2026-10-09', '2026-10-10', '2026-10-11'])
    expect(lerEscalaEmTexto('segunda-feira 7-13 Visita', seg).itens[0].data).toBe('2026-10-05')
    expect(lerEscalaEmTexto('05/01 7-13 UBS', '2026-12-28').itens[0].data).toBe('2027-01-05')
  })
  it('o que não entende vira aviso, sem inventar', async () => {
    const { lerEscalaEmTexto } = await import('./agenda')
    const r = lerEscalaEmTexto('amanhã cedo enfermaria; xyz 7-13 Algo; seg 25-26 X; seg 7-7 Y; 31/02 7-13 Z', seg)
    expect(r.itens).toEqual([]); expect(r.erros).toHaveLength(5)
  })
})

describe('paleta da agenda', () => {
  it('lerCores filtra tipo e cor; padrão quando não escolhido; a paleta contém as cores padrão e não tem verde do estudo nem vermelho', async () => {
    const { lerCores, corDaCategoria, PALETA_AGENDA, CATEGORIAS } = await import('./agenda')
    expect(lerCores({ plantao: '#ec4899', x: '#EC4899', aula: 'red', academia: 5 })).toEqual({ plantao: '#EC4899' })
    expect(lerCores(null)).toEqual({}); expect(lerCores([1])).toEqual({})
    expect(corDaCategoria('plantao', { plantao: '#EC4899' })).toBe('#EC4899'); expect(corDaCategoria('aula', { plantao: '#EC4899' })).toBe(CATEGORIAS.aula.cor)
    const cores = PALETA_AGENDA.map(p => p.cor) as string[]
    for (const c of Object.values(CATEGORIAS)) expect(cores).toContain(c.cor)
    expect(cores).not.toContain('#22C55E'); expect(cores).not.toContain('#EF4444'); expect(new Set(cores).size).toBe(cores.length)
  })
})

describe('sem duplicar', () => {
  it('mesmo nome (sem maiúsculas), dia(s) e horário = igual; a ordem dos dias não importa', async () => {
    const { semDuplicados } = await import('./agenda')
    const ex = [{ titulo: 'Academia', tipo: 'semanal', data: null, dias: [5, 1, 3], hora_ini: '18:00:00', hora_fim: '19:00:00' }]
    const r = semDuplicados([
      { titulo: ' academia ', tipo: 'semanal', data: null, dias: [1, 3, 5], hora_ini: '18:00', hora_fim: '19:00' },
      { titulo: 'Academia', tipo: 'semanal', data: null, dias: [1, 3], hora_ini: '18:00', hora_fim: '19:00' },
      { titulo: 'PS', tipo: 'pontual', data: '2026-10-06', dias: [], hora_ini: '19:00', hora_fim: '07:00' },
      { titulo: 'ps', tipo: 'pontual', data: '2026-10-06', dias: [], hora_ini: '19:00', hora_fim: '07:00' },
    ], ex)
    expect(r.novos.map(n => `${n.titulo}|${n.dias}`)).toEqual(['Academia|1,3', 'PS|']); expect(r.repetidos).toBe(2)
  })
})
