/** Regras do "deslizar" nas tarefas: quando um movimento conta como gesto e o que cada sentido faz. */
export type Sentido = 'direita' | 'esquerda'
export type AcaoGesto = 'concluir' | 'abrir' | 'adiar'

/** Distância mínima do gesto: 40% da largura da tarefa, entre 60 e 110 px (nem sensível demais, nem exigindo cruzar a tela). */
export const limiarDoGesto = (larguraPx: number) => Math.max(60, Math.min(110, Math.round(larguraPx * 0.4)))

/** Só é gesto se foi longe o bastante e mais na horizontal do que na vertical; senão era rolagem e a tarefa não reage. */
export function interpretarGesto(dx: number, dy: number, larguraPx: number): Sentido | null {
  if (Math.abs(dx) < limiarDoGesto(larguraPx)) return null
  if (Math.abs(dx) < Math.abs(dy) * 1.5) return null
  return dx > 0 ? 'direita' : 'esquerda'
}

// revisão, questões e simulado têm um resultado a registrar (e o XP depende dele): não se concluem só com um deslize
const COM_REGISTRO = ['revisao', 'questoes', 'simulado']

/** Para a direita conclui (ou abre o registro, quando o tipo pede um resultado); para a esquerda adia 1 dia. Tarefa concluída não reage. */
export function acaoDoGesto(sentido: Sentido, tipo: string, status: string): AcaoGesto | null {
  if (status === 'concluido') return null
  if (sentido === 'esquerda') return 'adiar'
  return COM_REGISTRO.includes(tipo) ? 'abrir' : 'concluir'
}

/** Texto que aparece atrás da tarefa enquanto ela é arrastada. */
export function rotuloDoGesto(acao: AcaoGesto | null, tipo: string): string | undefined {
  if (acao === 'concluir') return 'Concluir'
  if (acao === 'adiar') return 'Adiar 1 dia'
  if (acao === 'abrir') return tipo === 'revisao' ? 'Fazer revisão' : tipo === 'simulado' ? 'Registrar simulado' : 'Registrar questões'
  return undefined
}
