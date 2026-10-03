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
