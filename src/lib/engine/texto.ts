export const TAMANHOS = ['normal', 'grande', 'maior'] as const
export type Tamanho = (typeof TAMANHOS)[number]
export const ROTULOS_TAMANHO: Record<Tamanho, string> = { normal: 'Normal', grande: 'Grande', maior: 'Maior' }
/** Quanto cada escolha amplia o texto, sobre a base do aparelho (16 px; 17 px em tablet). Deve bater com as regras de globals.css. */
export const ESCALA: Record<Tamanho, number> = { normal: 1, grande: 1.125, maior: 1.25 }

/** O cookie "texto" vem do navegador: qualquer valor que não seja uma das três opções vale "normal". */
export const lerTamanho = (valor: string | null | undefined): Tamanho => ((TAMANHOS as readonly string[]).includes(valor ?? '') ? (valor as Tamanho) : 'normal')
