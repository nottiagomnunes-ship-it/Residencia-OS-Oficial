import { it, expect } from 'vitest'
import { readFileSync } from 'fs'

// GUARDA de velocidade: as páginas mais usadas buscam os dados em paralelo (Promise.all). Cada "await" a mais em sequência
// é uma ida e volta ao banco somada ao tempo de abrir a página. Se precisar de outro, prefira colocá-lo dentro do Promise.all.
const awaits = (f: string) => (readFileSync(f, 'utf8').match(/\bawait\b/g) ?? []).length
it.each([
  ['src/app/(app)/layout.tsx', 3], ['src/app/(app)/inicio/page.tsx', 2], ['src/app/(app)/calendario/page.tsx', 4],
  ['src/app/(app)/semana/page.tsx', 2], ['src/app/(app)/agenda/page.tsx', 3],
])('%s: no máximo %i esperas em sequência', (f, max) => { expect(awaits(f)).toBeLessThanOrEqual(max) })
it('as funções rodam na mesma região do banco (Supabase em ca-central-1 = Vercel yul1)', () => {
  expect(JSON.parse(readFileSync('vercel.json', 'utf8')).regions).toEqual(['yul1'])
})
