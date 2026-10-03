import { describe, it, expect, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
vi.mock('next/navigation', () => ({ useRouter: () => ({ push: () => {}, refresh: () => {} }) }))
vi.mock('@/lib/calendar', () => ({ concluirItem: vi.fn(), adiarItem: vi.fn() }))
vi.mock('@/lib/capacidade', () => ({ definirCapacidade: vi.fn() }))
vi.mock('@/lib/reorganizar', () => ({ adiantarTarefas: vi.fn(), reorganizarAtrasadas: vi.fn(), previaReorganizar: vi.fn() }))
vi.mock('@/components/BotaoCronometro', () => ({ default: () => null }))
vi.mock('@/components/ReorganizarAtrasadas', () => ({ default: () => null }))
import TarefasHoje from './TarefasHoje'

const base = { itens: [], hoje: '2026-10-07', concluidasHoje: 0, minutosHoje: 120, minutosFeitos: 0, adiantaveis: [], recursos: true }
const texto = (h: string) => h.replace(/<!-- -->/g, '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ')
describe('Início: sugestão da agenda para o tempo de hoje', () => {
  it('aparece com o botão quando o tempo de hoje ainda não é o sugerido', () => {
    const h = renderToStaticMarkup(<TarefasHoje {...base} informado={false} agenda={{ texto: '5h livres (13h30–18h30)', sugestao: 120 }} />)
    expect(texto(h)).toContain('Pela sua agenda, hoje: 5h livres (13h30–18h30). Sugestão: 2 h'); expect(texto(h)).toContain('Usar 2 h')
  })
  it('some quando você já escolheu esse tempo, e não aparece sem agenda', () => {
    expect(texto(renderToStaticMarkup(<TarefasHoje {...base} informado agenda={{ texto: 'x', sugestao: 120 }} />))).not.toContain('Pela sua agenda')
    expect(texto(renderToStaticMarkup(<TarefasHoje {...base} informado={false} />))).not.toContain('Pela sua agenda')
  })
})
