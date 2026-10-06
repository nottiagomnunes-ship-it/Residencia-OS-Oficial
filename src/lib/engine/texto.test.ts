import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'fs'
import { join } from 'path'
import { lerTamanho, TAMANHOS, ESCALA } from './texto'

const css = readFileSync('src/app/globals.css', 'utf8')
const arquivos = (d: string): string[] => readdirSync(d).flatMap(n => { const p = join(d, n); return statSync(p).isDirectory() ? arquivos(p) : [p] })

describe('tamanho do texto', () => {
  it('só as três opções valem; qualquer outra coisa do cookie vira "normal"', () => {
    expect(TAMANHOS).toEqual(['normal', 'grande', 'maior'])
    for (const v of ['normal', 'grande', 'maior']) expect(lerTamanho(v)).toBe(v)
    for (const v of [undefined, null, '', 'enorme', 'GRANDE', ' grande', '1.5', '<script>']) expect(lerTamanho(v as any)).toBe('normal')
  })
  it('as escalas do código batem com as do CSS', () => {
    for (const t of ['grande', 'maior'] as const) expect(css).toContain(`html[data-texto='${t}'] { --texto-escala: ${ESCALA[t]}; }`)
    expect(ESCALA.normal).toBe(1); expect(ESCALA.grande).toBeLessThan(ESCALA.maior)
  })
  it('o CSS multiplica a base do aparelho pela escolha, e o tablet continua um pouco maior', () => {
    expect(css).toContain('html { font-size: calc(var(--texto-base) * var(--texto-escala)); }'); expect(css).toContain(':root { --texto-base: 16px; --texto-escala: 1; }')
    expect(css).toMatch(/@media \(min-width: 768px\) and \(pointer: coarse\) \{ :root \{ --texto-base: 17px; \} \}/)
  })
  it('campos de formulário no toque nunca ficam abaixo de 16 px (o iPhone daria zoom) e acompanham o ajuste', () => { expect(css).toContain('font-size: max(16px, 1rem) !important') })
  it('GUARDA: nenhum texto em tamanho fixo em px (não acompanharia o ajuste); os pequenos usam rem', () => {
    const achados = arquivos('src').filter(f => /\.tsx?$/.test(f) && !f.includes('.test.')).flatMap(f => (readFileSync(f, 'utf8').match(/text-\[[0-9.]+px\]/g) ?? []).map(m => `${f}: ${m}`))
    expect(achados).toEqual([])
  })
  it('GUARDA: o texto arbitrário em rem nunca é menor que 11 px (0,6875 rem)', () => {
    const menores = arquivos('src').filter(f => /\.tsx$/.test(f) && !f.includes('.test.')).flatMap(f => [...readFileSync(f, 'utf8').matchAll(/text-\[([0-9.]+)rem\]/g)].filter(m => parseFloat(m[1]) < 0.6875).map(m => `${f}: ${m[0]}`))
    expect(menores).toEqual([])
  })
  it('o layout raiz entrega o tamanho escolhido já na primeira resposta (sem piscar)', () => {
    const l = readFileSync('src/app/layout.tsx', 'utf8'); expect(l).toContain("c.get('texto')"); expect(l).toContain('data-texto={texto}'); expect(l).toContain("c.get('tema')"); expect(l).toContain('data-tema={tema}')
  })
})

describe('tema', () => {
  it('cookie inválido ou ausente = escuro (o visual de sempre); as três opções valem', async () => {
    const { lerTema, TEMAS } = await import('./tema')
    expect(lerTema(undefined)).toBe('escuro'); expect(lerTema('roxo')).toBe('escuro')
    for (const t of TEMAS) expect(lerTema(t)).toBe(t)
  })
  it('o CSS tem as cores do tema claro para "claro" e para "igual ao aparelho" com o celular no claro', () => {
    const css = readFileSync('src/app/globals.css', 'utf8')
    expect(css).toContain("html[data-tema='claro']"); expect(css).toMatch(/prefers-color-scheme: light\)[\s\S]*html\[data-tema='sistema'\]/)
    for (const v of ['--c-bg', '--c-ink', '--c-brand', '--c-on-cor']) expect(css.split(v).length).toBeGreaterThanOrEqual(4) // escuro, claro e sistema
  })
})
