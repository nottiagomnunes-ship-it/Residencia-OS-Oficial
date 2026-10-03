import { AREAS, ROTULO_AREA, ehArea, normalizar, type Area } from './areas'
import type { Paragrafo } from './provas-docx'

export const LETRAS = ['A', 'B', 'C', 'D', 'E'] as const
export type Letra = (typeof LETRAS)[number]
export const ehLetra = (v: unknown): v is Letra => typeof v === 'string' && (LETRAS as readonly string[]).includes(v)

export type Bloco = { tipo: 'texto'; texto: string } | { tipo: 'imagem'; caminho: string }
export type Alternativa = { letra: Letra; texto: string }
export type QuestaoLida = { numero: number; blocos: Bloco[]; alternativas: Alternativa[] }
export type ProvaLida = { titulo: string | null; questoes: QuestaoLida[]; gabaritoTexto: string | null; avisos: string[] }

// "QUESTÃO 01", "Questão 1 -", "QUESTAO Nº 12:" (o que vier depois do número na mesma linha já é o enunciado)
const CABECALHO = /^QUEST[ÃãAa][OoÕõ]\s*(?:N[º°o]?\.?\s*)?(\d{1,3})(?!\d)\s*[-–—.:)]?\s*([\s\S]*)$/i
// "A) texto", "(B) texto", "c. texto", "D - texto"
const ALTERNATIVA = /^\(?([A-Ea-e])\s*[)\].\-–—]\s*([\s\S]*)$/
const GABARITO = /^GABARITO\b[\s:–—-]*([\s\S]*)$/i

/**
 * Monta as questões a partir dos parágrafos do Word. Formato esperado: um título "QUESTÃO N" por questão, o enunciado (texto e figuras) e as
 * alternativas começando por "A)", "B)"... Uma alternativa só é aceita se for a próxima letra (um "B)" solto no meio do enunciado não vira alternativa).
 * Um título "GABARITO" no fim (opcional) é guardado para ser lido como gabarito.
 */
export function montarQuestoes(paragrafos: Paragrafo[]): ProvaLida {
  // cada linha (quebra manual dentro do parágrafo) é tratada como um parágrafo; as figuras ficam com a última linha
  const linhas = paragrafos.flatMap(p => {
    const ls = p.texto.split('\n').map(l => l.trim())
    return ls.map((texto, i) => ({ texto, imagens: i === ls.length - 1 ? p.imagens : [] }))
  })
  const questoes: QuestaoLida[] = [], preambulo: string[] = [], gab: string[] = [], avisos: string[] = []
  let atual: QuestaoLida | null = null, noGabarito = false, figurasSoltas = 0

  const dentroDaQuestao = (q: QuestaoLida, texto: string, imagens: string[]) => {
    if (texto) {
      const a = texto.match(ALTERNATIVA)
      if (a && a[1].toUpperCase() === LETRAS[q.alternativas.length]) q.alternativas.push({ letra: LETRAS[q.alternativas.length], texto: a[2].trim() })
      else if (q.alternativas.length) { const ult = q.alternativas[q.alternativas.length - 1]; ult.texto = ult.texto ? `${ult.texto}\n${texto}` : texto }
      else q.blocos.push({ tipo: 'texto', texto })
    }
    for (const c of imagens) q.blocos.push({ tipo: 'imagem', caminho: c })
  }

  for (const { texto, imagens } of linhas) {
    if (noGabarito) { if (texto) gab.push(texto); continue }
    const g = texto.match(GABARITO)
    if (g && (!atual || atual.alternativas.length)) { noGabarito = true; if (g[1].trim()) gab.push(g[1].trim()); continue }
    const c = texto.match(CABECALHO)
    if (c) {
      atual = { numero: Number(c[1]), blocos: [], alternativas: [] }
      questoes.push(atual)
      dentroDaQuestao(atual, c[2].trim(), imagens)
      continue
    }
    if (!atual) { if (texto) preambulo.push(texto); figurasSoltas += imagens.length; continue }
    dentroDaQuestao(atual, texto, imagens)
  }

  if (!questoes.length) avisos.push('Nenhuma questão encontrada. Cada questão precisa começar com uma linha "QUESTÃO 1", "QUESTÃO 2"...')
  if (figurasSoltas) avisos.push(`${figurasSoltas} figura(s) antes da primeira questão foram ignoradas.`)
  const vistos = new Set<number>()
  questoes.forEach((q, i) => {
    const repetida = vistos.has(q.numero)
    if (repetida) avisos.push(`A questão ${q.numero} aparece mais de uma vez.`)
    vistos.add(q.numero)
    if (i > 0 && !repetida && q.numero !== questoes[i - 1].numero + 1 && !vistos.has(questoes[i - 1].numero + 1)) avisos.push(`Depois da questão ${questoes[i - 1].numero} vem a ${q.numero}: confira se faltou alguma.`)
    if (!q.blocos.length) avisos.push(`Questão ${q.numero}: sem enunciado.`)
    if (q.alternativas.length < 2) avisos.push(`Questão ${q.numero}: nenhuma alternativa reconhecida (elas precisam começar com "A)", "B)"...).`)
    else if (q.alternativas.length < 4) avisos.push(`Questão ${q.numero}: só ${q.alternativas.length} alternativas (A a ${LETRAS[q.alternativas.length - 1]}).`)
  })
  return { titulo: preambulo[0] ?? null, questoes, gabaritoTexto: gab.length ? gab.join('\n') : null, avisos }
}

/** Texto corrido da questão (para o caderno de erros e para sugerir a área). Figuras viram "[figura]". */
export const textoDosBlocos = (blocos: Bloco[]) => blocos.map(b => (b.tipo === 'texto' ? b.texto : '[figura]')).join('\n\n')

/** "UEPA 2022" → banca "UEPA", ano 2022 (só um palpite para preencher a tela; a pessoa corrige). */
export function palpiteDeNome(titulo: string | null, arquivo: string) {
  const base = (titulo || arquivo.replace(/\.docx$/i, '').replace(/[_]+/g, ' ')).trim().slice(0, 120)
  const ano = base.match(/\b(19[89]\d|20\d\d)\b/)?.[1]
  const banca = base.split(/[\s_\-–—]+/)[0] ?? ''
  return { nome: base || 'Prova', banca: /^[A-ZÀ-Ú0-9]{2,}$/.test(banca) ? banca : '', ano: ano ? Number(ano) : null }
}

// ---------- Gabarito ----------

export type RespostaGabarito = Letra | 'X' // X = anulada

/**
 * Lê um gabarito colado em quase qualquer formato: "1-B 2-C", "01 B 02 C", "1.B", tabela copiada de PDF ("01 02 03" numa linha e "B C A" na
 * seguinte) ou só as letras em sequência ("BBCDA..."). Anulada: X, *, "ANULADA". Números que não existem na prova são ignorados e avisados.
 */
export function lerGabarito(texto: string, numeros: number[]) {
  const existe = new Set(numeros), respostas = new Map<number, RespostaGabarito>(), fora: number[] = []
  const t = texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase()
  // só letras (separadas ou coladas: "B A C" ou "BACDE"), sem nenhum número: em sequência, a partir da primeira questão
  const so = t.replace(/[\s,;.\-–—/|]+/g, '')
  if (!/\d/.test(t) && so && /^[A-EX*]+$/.test(so)) [...so].slice(0, numeros.length).forEach((c, i) => respostas.set(numeros[i], c === '*' ? 'X' : (c as RespostaGabarito)))
  else {
    const fila: number[] = []
    let ultimo = -1 // posição em `numeros` da última questão preenchida (uma letra sem número vai para a seguinte)
    const definir = (n: number, r: RespostaGabarito) => { if (existe.has(n)) respostas.set(n, r); else fora.push(n) }
    for (const f of t.matchAll(/\b(\d{1,3})\b|\b(ANULADA|ANULADO|ANULADAS|NULA|[A-E]|X)\b|(\*)/g)) {
      if (f[1]) { fila.push(Number(f[1])); continue }
      const r: RespostaGabarito = f[3] || (f[2] && f[2].length > 1) ? 'X' : (f[2] as RespostaGabarito)
      if (fila.length) { const n = fila.shift()!; definir(n, r); ultimo = numeros.indexOf(n) }
      else if (ultimo + 1 < numeros.length) { ultimo++; respostas.set(numeros[ultimo], r) }
    }
  }
  const faltando = numeros.filter(n => !respostas.has(n))
  const anuladas = numeros.filter(n => respostas.get(n) === 'X')
  return { respostas, faltando, anuladas, fora: [...new Set(fora)] }
}

/** Uma faixa de números para mostrar ao usuário: [1,2,3,7,9,10] → "1–3, 7, 9–10". */
export function faixas(ns: number[]) {
  const o = [...new Set(ns)].sort((a, b) => a - b), partes: string[] = []
  for (let i = 0; i < o.length; i++) {
    let j = i
    while (j + 1 < o.length && o[j + 1] === o[j] + 1) j++
    partes.push(i === j ? String(o[i]) : `${o[i]}–${o[j]}`)
    i = j
  }
  return partes.join(', ')
}

// ---------- Área de cada questão ----------

// Pistas no texto da questão. Peso 2 = muito característico da área; peso 1 = ajuda, mas aparece em outras áreas também.
const PISTAS: Record<Area, [number, string[]][]> = {
  preventiva: [
    [2, ['sus', 'sistema unico de saude', 'universalidade', 'equidade', 'integralidade', 'prevalencia', 'incidencia', 'sensibilidade', 'especificidade', 'valor preditivo*', 'acuracia',
      'coorte', 'caso controle', 'ensaio clinico', 'metanalise', 'meta analise', 'revisao sistematica', 'forest plot', 'risco relativo', 'odds ratio', 'razao de chances',
      'intervalo de confianca', 'vies', 'estudo transversal', 'estudo ecologico', 'notificacao', 'notificac*', 'vigilancia*', 'epidemiolog*', 'indicador*', 'coeficiente*',
      'mortalidade materna', 'mortalidade infantil', 'atencao primaria', 'atencao basica', 'saude da familia', 'esf', 'nasf', 'agente comunitario', 'agentes comunitarios',
      'prevencao primaria', 'prevencao secundaria', 'prevencao terciaria', 'prevencao quaternaria', 'quaternaria', 'nivel de prevencao', 'declaracao de obito',
      'codigo de etica', 'etica medica', 'sigilo medico', 'cfm', 'controle social', 'conselho de saude', 'territorializacao', 'medicina de familia', 'genograma', 'ecomapa',
      'rastreamento', 'nnt', 'p valor', 'hipotese nula', 'sistemas de informacao', 'sinan', 'sim', 'sinasc', 'nelson moraes', 'curva de nelson', 'gestores', 'rede de atencao',
      'saude do trabalhador', 'acidente de trabalho', 'cuidado paliativo', 'cuidados paliativos', 'ubs', 'unidade basica']],
    [1, ['estudo', 'amostra', 'populacao', 'principio*', 'politica nacional', 'ministerio da saude', 'programa*', 'abandono do tratamento', 'calendario vacinal']],
  ],
  pediatria: [
    [3, ['lactente*', 'recem nascido*', 'recem nascida', 'neonat*', 'pre escolar', 'escolar de', 'puericultura', 'apgar', 'pediatri*']],
    [2, ['crianca*', 'aleitamento', 'leite materno', 'prematur*', 'bronquiolite', 'menino', 'menina', 'primogenito', 'filho de', 'mae trouxe', 'mae relata', 'meses de idade',
      'meses de vida', 'dias de vida', 'horas de vida', 'kawasaki', 'crupe', 'coqueluche', 'desnutri*', 'z escore', 'escore z']],
    [1, ['vacina*', 'adolescen*', 'desidratacao', 'diarreia', 'varicela', 'sarampo']],
  ],
  go: [
    [3, ['gestante*', 'gestacao', 'gravidez', 'idade gestacional', 'semanas de gestacao', 'pre natal', 'puerper*', 'obstetric*', 'ginecolog*', 'primigesta', 'secundigesta',
      'nuligesta', 'multigesta', 'menarca', 'menopausa', 'climaterio', 'colpocitologia', 'papanicolau']],
    [2, ['parto*', 'cesarea', 'utero', 'uterin*', 'ovari*', 'endometri*', 'mioma*', 'colo do utero', 'colo uterino', 'hpv', 'menstrua*', 'amenorreia', 'contracep*',
      'anticoncep*', 'diu', 'vulv*', 'vagin*', 'placenta*', 'eclampsia', 'pre eclampsia', 'abortamento', 'aborto', 'beta hcg', 'fogacho*', 'assoalho pelvico', 'pelve feminina',
      'mama*', 'mamograf*', 'ciclos menstruais', 'sangramento vaginal', 'trabalho de parto']],
    [1, ['mulher', 'feminino', 'sifilis', 'toxoplasmose', 'incontinencia urinaria']],
  ],
  cirurgia: [
    [3, ['cirurgi*', 'cirurgic*', 'trauma*', 'politrauma*', 'atls', 'laparotomia', 'laparoscop*', 'pos operatori*', 'intraoperatori*', 'intra operatori*', 'pre operatori*',
      'hernia*', 'herniorrafia', 'hernioplastia', 'colecistectomia', 'gastrectomia', 'apendic*', 'queimadura*', 'arma branca', 'arma de fogo']],
    [2, ['abdome agudo', 'colecist*', 'colelitiase', 'obstrucao intestinal', 'volvo', 'fratura*', 'ferimento*', 'acidente automobilistico', 'motoqueiro', 'queda de',
      'choque hemorragico', 'pneumotorax', 'hemotorax', 'drenagem', 'anestesi*', 'sutura', 'anastomose', 'isquemia mesenterica', 'diverticulite', 'hematemese',
      'hematoquezia', 'colonoscopia', 'gist', 'incisao', 'aneurisma', 'embolizacao', 'bariatrica', 'massa palpavel', 'ictericia obstrutiva', 'litiase*']],
    [1, ['pancreatite', 'hemorragia digestiva', 'colica', 'ictericia', 'pronto socorro']],
  ],
  clinica: [
    [2, ['insuficiencia cardiaca', 'infarto', 'angina', 'fibrilacao atrial', 'arritmia*', 'pneumonia', 'asma', 'dpoc', 'tuberculose', 'cirrose', 'insuficiencia renal',
      'doenca renal', 'glomerul*', 'sindrome nefrotica', 'tireoid*', 'hipotireoid*', 'hipertireoid*', 'anemia*', 'leucemia', 'linfoma', 'lupus', 'artrite', 'sepse',
      'meningite', 'epilepsia', 'convuls*', 'demencia', 'depressao', 'esquizofren*', 'dengue', 'malaria', 'leishmaniose', 'endocardite', 'tromboembolismo', 'cefaleia*',
      'transfus*', 'hemocomponente*', 'intubacao', 'via aerea', 'ventilacao mecanica', 'insuficiencia respiratoria', 'acidente botropico', 'hemolitica', 'trato urinario',
      'ceftriaxona', 'antibiotic*', 'esteatose', 'transaminases', 'herpes zoster', 'metformina', 'glibenclamida', 'insulina*', 'cetoacidose', 'hiponatremia', 'hipercalemia',
      'gasometria', 'sindrome uremica', 'uremic*', 'emergencia']],
    [1, ['hipertens*', 'diabet*', 'dm2', 'obeso', 'obesidade', 'avc', 'hiv', 'hepatite*', 'dislipidemia', 'tabagista']],
  ],
}
const casa = (texto: string, padrao: string) => (padrao.endsWith('*') ? (' ' + texto).includes(' ' + padrao.slice(0, -1)) : (' ' + texto + ' ').includes(' ' + padrao + ' '))

/** Pontos de cada área para um texto de questão. A idade do paciente ajuda: meses/dias de vida ou até 12 anos puxam para Pediatria. */
export function pontosPorArea(texto: string): Record<Area, number> {
  const t = normalizar(texto), pts = Object.fromEntries(AREAS.map(a => [a, 0])) as Record<Area, number>
  for (const a of AREAS) for (const [peso, lista] of PISTAS[a]) for (const p of lista) if (casa(t, p)) pts[a] += peso
  const idade = t.match(/\b(\d{1,3}) (anos?|mes|meses|dias|horas)\b/)
  if (idade) {
    const n = Number(idade[1]), u = idade[2]
    if (u !== 'anos' && u !== 'ano') pts.pediatria += 3
    else if (n <= 12) pts.pediatria += 3
    else if (n <= 17) pts.pediatria += 1
  }
  if (/\bg\s?[0-9ivx]+ ?p\s?[0-9ivxo]+/.test(t)) pts.go += 3 // "G2 P1 A0"
  return pts
}

/** A área mais provável de uma questão, ou null se nada indica ou se há empate no topo. */
export function sugerirAreaDaQuestao(texto: string): Area | null {
  const pts = pontosPorArea(texto), ord = AREAS.map(a => [a, pts[a]] as const).sort((x, y) => y[1] - x[1])
  if (ord[0][1] < 2 || ord[0][1] === ord[1][1]) return null
  return ord[0][0]
}

/**
 * Áreas sugeridas para a prova inteira. Muitas provas vêm em 5 blocos do mesmo tamanho, um por área (UEPA: 1–20 Preventiva, 21–40 Clínica...).
 * Se em cada quinto da prova uma área diferente é a maioria (pelo menos 40% das questões do bloco), a prova é tratada por blocos e todas as questões
 * do bloco recebem a área dele. Senão, cada questão fica com a sua sugestão (ou sem área).
 */
export function sugerirAreas(textos: string[]): { areas: (Area | null)[]; porBlocos: boolean } {
  const individuais = textos.map(sugerirAreaDaQuestao), n = textos.length
  if (n >= 25 && n % 5 === 0) {
    const tam = n / 5, maiorias: (Area | null)[] = []
    for (let b = 0; b < 5; b++) {
      const bloco = individuais.slice(b * tam, (b + 1) * tam), cont = new Map<Area, number>()
      for (const a of bloco) if (a) cont.set(a, (cont.get(a) ?? 0) + 1)
      const topo = [...cont.entries()].sort((x, y) => y[1] - x[1])[0]
      maiorias.push(topo && topo[1] >= tam * 0.4 ? topo[0] : null)
    }
    if (maiorias.every(Boolean) && new Set(maiorias).size === 5) return { areas: textos.map((_, i) => maiorias[Math.floor(i / tam)]), porBlocos: true }
  }
  return { areas: individuais, porBlocos: false }
}

// ---------- Correção ----------

export type Situacao = 'certa' | 'errada' | 'branco' | 'anulada'
export type QuestaoParaCorrigir = { id: string; numero: number; gabarito: Letra | null; anulada: boolean; area?: Area | null }
export type RespostaDada = { alternativa: Letra | null; chute: boolean }

/**
 * Corrige uma tentativa. Anuladas não contam no total. Em branco conta como erro. Vai para o caderno: o que errou, o que deixou em branco e
 * o que acertou marcando "chutei" (acerto que não é conhecimento).
 */
export function corrigir(questoes: QuestaoParaCorrigir[], respostas: Record<string, RespostaDada | undefined>) {
  const semGabarito = questoes.filter(q => !q.anulada && !q.gabarito).map(q => q.numero)
  const itens = questoes.map(q => {
    const r = respostas[q.id], alternativa = r?.alternativa ?? null, chute = !!r?.chute
    const situacao: Situacao = q.anulada ? 'anulada' : !alternativa ? 'branco' : alternativa === q.gabarito ? 'certa' : 'errada'
    return { id: q.id, numero: q.numero, area: q.area ?? null, alternativa, gabarito: q.gabarito, chute, situacao,
      vaiProCaderno: situacao === 'errada' || situacao === 'branco' || (situacao === 'certa' && chute) }
  })
  const conta = (s: Situacao) => itens.filter(i => i.situacao === s).length
  const acertos = conta('certa'), anuladas = conta('anulada')
  return { itens, total: questoes.length - anuladas, acertos, erros: conta('errada'), brancos: conta('branco'), anuladas,
    chutesCertos: itens.filter(i => i.situacao === 'certa' && i.chute).length, semGabarito }
}

export type LinhaDeArea = { area: Area | null; rotulo: string; total: number; acertos: number; pct: number | null }
/** Acerto por área nesta prova (só as áreas que têm questões; "Sem área" por último). */
export function resultadoPorArea(itens: { area: Area | null; situacao: Situacao }[]): LinhaDeArea[] {
  const linha = (area: Area | null): LinhaDeArea => {
    const d = itens.filter(i => i.area === area && i.situacao !== 'anulada'), acertos = d.filter(i => i.situacao === 'certa').length
    return { area, rotulo: area ? ROTULO_AREA[area] : 'Sem área', total: d.length, acertos, pct: d.length ? Math.round((acertos / d.length) * 100) : null }
  }
  return [...AREAS.map(linha), linha(null)].filter(l => l.total > 0)
}

/** O texto que vai para o caderno de erros: de onde é a questão, o enunciado, as alternativas e a sua resposta ao lado do gabarito. */
export function textoParaCaderno(prova: string, q: { numero: number; blocos: Bloco[]; alternativas: Alternativa[] }, sua: Letra | null, gabarito: Letra | null) {
  const alts = q.alternativas.map(a => `${a.letra}) ${a.texto}`).join('\n')
  return `${prova} · Questão ${q.numero}\n\n${textoDosBlocos(q.blocos)}\n\n${alts}\n\nSua resposta: ${sua ?? 'em branco'} · Gabarito: ${gabarito ?? '—'}`.slice(0, 20000)
}

/** Cronômetro da prova: "0:07:05", "2:31:40". */
export const relogio = (seg: number) => {
  const s = Math.max(0, Math.floor(seg)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60)
  return `${h}:${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// ---------- Conferência do que chega ao servidor ----------

export type QuestaoImportada = { numero: number; blocos: Bloco[]; alternativas: Alternativa[]; gabarito: Letra | null; anulada: boolean; area: Area | null }
export type ProvaImportada = { id: string; nome: string; banca: string | null; ano: number | null; questoes: QuestaoImportada[] }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const ehUuid = (v: unknown): v is string => typeof v === 'string' && UUID.test(v)
const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

/**
 * Confere a prova enviada pelo navegador antes de gravar: formato, limites de tamanho, letras em sequência, gabarito entre as alternativas da
 * questão e figuras só dentro da pasta desta pessoa e desta prova no armazenamento. Devolve a versão limpa ou o motivo da recusa.
 */
export function validarProvaImportada(v: unknown, uid: string): { ok: true; prova: ProvaImportada } | { ok: false; erro: string } {
  const p = v as Record<string, unknown>
  if (!p || typeof p !== 'object') return { ok: false, erro: 'Dados da prova ausentes.' }
  if (!ehUuid(p.id)) return { ok: false, erro: 'Identificador da prova inválido.' }
  const nome = texto(p.nome, 120)
  if (!nome) return { ok: false, erro: 'Dê um nome à prova.' }
  const ano = p.ano == null || p.ano === '' ? null : Number(p.ano)
  if (ano !== null && (!Number.isInteger(ano) || ano < 1980 || ano > 2100)) return { ok: false, erro: 'Ano inválido.' }
  if (!Array.isArray(p.questoes) || !p.questoes.length) return { ok: false, erro: 'A prova não tem questões.' }
  if (p.questoes.length > 300) return { ok: false, erro: 'A prova tem mais de 300 questões.' }
  const pasta = `${uid}/${p.id}/`, numeros = new Set<number>(), questoes: QuestaoImportada[] = []
  for (const bruta of p.questoes as Record<string, unknown>[]) {
    const numero = Number(bruta?.numero)
    if (!Number.isInteger(numero) || numero < 1 || numero > 999) return { ok: false, erro: 'Número de questão inválido.' }
    if (numeros.has(numero)) return { ok: false, erro: `A questão ${numero} aparece duas vezes. Corrija o arquivo e importe de novo.` }
    numeros.add(numero)
    if (!Array.isArray(bruta.blocos) || bruta.blocos.length > 60) return { ok: false, erro: `Questão ${numero}: enunciado inválido.` }
    const blocos: Bloco[] = []
    for (const b of bruta.blocos as Record<string, unknown>[]) {
      if (b?.tipo === 'texto') { const t = texto(b.texto, 20000); if (t) blocos.push({ tipo: 'texto', texto: t }) }
      else if (b?.tipo === 'imagem' && typeof b.caminho === 'string' && b.caminho.startsWith(pasta) && /^[\w-]+\/[\w-]+\/[\w.-]{1,80}$/.test(b.caminho)) blocos.push({ tipo: 'imagem', caminho: b.caminho })
      else return { ok: false, erro: `Questão ${numero}: figura ou trecho inválido.` }
    }
    if (!Array.isArray(bruta.alternativas) || bruta.alternativas.length < 2 || bruta.alternativas.length > 5) return { ok: false, erro: `Questão ${numero}: precisa ter de 2 a 5 alternativas.` }
    const alternativas: Alternativa[] = (bruta.alternativas as Record<string, unknown>[]).map((a, i) => ({ letra: LETRAS[i], texto: texto(a?.texto, 5000) }))
    if ((bruta.alternativas as Record<string, unknown>[]).some((a, i) => a?.letra !== LETRAS[i])) return { ok: false, erro: `Questão ${numero}: alternativas fora de ordem.` }
    const gabarito = bruta.gabarito == null || bruta.gabarito === '' ? null : bruta.gabarito
    if (gabarito !== null && !(ehLetra(gabarito) && alternativas.some(a => a.letra === gabarito))) return { ok: false, erro: `Questão ${numero}: o gabarito não é uma das alternativas.` }
    questoes.push({ numero, blocos, alternativas, gabarito, anulada: bruta.anulada === true, area: ehArea(bruta.area) ? bruta.area : null })
  }
  return { ok: true, prova: { id: p.id as string, nome, banca: texto(p.banca, 60) || null, ano, questoes } }
}

/**
 * O que gravar a partir do gabarito lido: só as questões encontradas no texto (as outras ficam como estão). "X" = anulada (sem letra).
 * Uma letra que não existe na questão (E numa questão de 4 alternativas) não é gravada e é avisada.
 */
export function itensDoGabarito(questoes: { numero: number; alternativas: number }[], respostas: Map<number, RespostaGabarito>) {
  const itens: { numero: number; gabarito: Letra | null; anulada: boolean }[] = [], invalidas: number[] = []
  for (const q of questoes) {
    const r = respostas.get(q.numero)
    if (!r) continue
    if (r === 'X') itens.push({ numero: q.numero, gabarito: null, anulada: true })
    else if (LETRAS.indexOf(r) < q.alternativas) itens.push({ numero: q.numero, gabarito: r, anulada: false })
    else invalidas.push(q.numero)
  }
  return { itens, invalidas }
}

/** O gabarito gravado, de volta em texto ("1-A 2-B 3-X"), para aparecer no campo e ser corrigido à mão. */
export const gabaritoEmTexto = (questoes: { numero: number; gabarito: Letra | null; anulada: boolean }[]) =>
  questoes.filter(q => q.anulada || q.gabarito).map(q => `${q.numero}-${q.anulada ? 'X' : q.gabarito}`).join(' ')
