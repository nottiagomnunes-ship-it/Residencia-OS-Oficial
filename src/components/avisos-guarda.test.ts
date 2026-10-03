import { describe, it, expect } from 'vitest'
import { readFileSync } from 'fs'

const ler = (p: string) => readFileSync(p, 'utf8')

describe('avisos: todo lugar do app usa o sistema único', () => {
  it('o layout do app envolve tudo com os avisos (por fora do cronômetro, que também os usa)', () => {
    const l = ler('src/app/(app)/layout.tsx'); expect(l).toContain('<AvisosProvider>'); expect(l.indexOf('<AvisosProvider>')).toBeLessThan(l.indexOf('<CronometroProvider')); expect(l.indexOf('</CronometroProvider>')).toBeLessThan(l.indexOf('</AvisosProvider>'))
  })
  for (const [pagina, chaves] of [['questoes', ['ok', 'erro']], ['simulados', ['ok', 'erro']], ['configuracoes', ['ok', 'aviso', 'erro']]] as const) {
    it(`${pagina}: as mensagens que voltam pela URL viram aviso temporário (e a URL é limpa)`, () => {
      const p = ler(`src/app/(app)/${pagina}/page.tsx`); expect(p).toContain("import AvisoDaUrl from '@/components/AvisoDaUrl'")
      for (const c of chaves) expect(p, `${pagina}: ${c}`).toMatch(new RegExp(`<AvisoDaUrl tipo="(ok|erro)" chaves=\\{\\[[^\\]]*'${c}'`))
      expect(p).not.toMatch(/\{(ok|erro|aviso)[^}]*<p role="(status|alert)"/)    // sem as faixas fixas de antes
    })
  }
  it('em Configurações só o aviso de ESTADO do lembrete por e-mail continua fixo (ele não é um resultado, é uma situação)', () => {
    const faixas = ler('src/app/(app)/configuracoes/page.tsx').match(/role="(status|alert)"/g) ?? []; expect(faixas).toHaveLength(1); expect(ler('src/app/(app)/configuracoes/page.tsx')).toContain('p?.lembrete_aviso && <p role="status"')
  })
  it('o cronômetro, o painel Hoje, reorganizar e restaurar não têm mais aviso próprio', () => {
    expect(ler('src/components/CronometroProvider.tsx')).toContain("useAvisos()"); expect(ler('src/components/CronometroProvider.tsx')).not.toContain('setAviso')
    expect(ler('src/components/TarefasHoje.tsx')).not.toMatch(/setAviso|avisoGesto/); expect(ler('src/components/ReorganizarAtrasadas.tsx')).not.toContain('setMsg'); expect(ler('src/components/RestaurarBackup.tsx')).not.toContain('setAviso')
  })
  it('adiar e mover oferecem "Desfazer" no calendário e no painel Hoje', () => {
    for (const f of ['src/components/CalendarBoard.tsx', 'src/components/TarefasHoje.tsx']) { expect(ler(f), f).toContain('useAvisoDeMovimento'); expect(ler(f), f).toContain('avisarMovida(') }
    const a = ler('src/lib/calendar.ts'); expect(a).toContain('export async function desfazerMovimento'); expect(a).toContain('validarDesfazer(entrada)')
  })
  it('o aviso fica no topo, acima de janelas, e respeita "menos movimento"', () => {
    const a = ler('src/components/Avisos.tsx'); expect(a).toContain('top-[calc(0.75rem+env(safe-area-inset-top))]'); expect(a).toContain('z-[60]'); expect(a).toContain('aria-live="polite"'); expect(a).toContain('motion-safe:animate-[aviso-entra_180ms_ease-out]')
    expect(ler('src/app/globals.css')).toContain('@keyframes aviso-entra')
  })
  it('toda ação do app que volta para uma tela com ?ok=/?erro=/?aviso= cai numa página que sabe mostrar (nada de mensagem perdida)', () => {
    const destinos = new Set<string>()
    for (const f of ['config', 'lembretes', 'questoes', 'simulados']) for (const m of ler(`src/lib/${f}.ts`).matchAll(/redirect\([^)]*['`](\/[a-z-]+)\?(?:ok|erro|aviso)=/g)) destinos.add(m[1])
    expect([...destinos].sort()).toEqual(['/configuracoes', '/questoes', '/simulados'])
    for (const d of destinos) expect(ler(`src/app/(app)${d}/page.tsx`), d).toContain('AvisoDaUrl')
  })
})
