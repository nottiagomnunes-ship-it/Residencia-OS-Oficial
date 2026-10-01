// Catálogo inicial de assuntos por disciplina → subcategoria → assuntos
export const CATALOGO: Record<string, Record<string, string[]>> = {
  'Clínica Médica': {
    Cardiologia: ['Hipertensão arterial', 'Insuficiência cardíaca', 'Síndromes coronarianas agudas', 'Fibrilação atrial'],
    Pneumologia: ['DPOC', 'Asma', 'Pneumonia adquirida na comunidade', 'Tromboembolismo pulmonar'],
    Endocrinologia: ['Diabetes mellitus', 'Hipotireoidismo', 'Hipertireoidismo'],
    Neurologia: ['AVC'], Nefrologia: ['Injúria renal aguda'], Infectologia: ['HIV/aids', 'Tuberculose'],
  },
  Cirurgia: {
    Trauma: ['Atendimento inicial ao trauma', 'Trauma abdominal', 'Trauma torácico'],
    'Abdome agudo': ['Apendicite aguda', 'Colecistite e colangite', 'Pancreatite aguda', 'Obstrução intestinal'],
    Geral: ['Hérnias da parede abdominal', 'Queimaduras'],
  },
  Pediatria: {
    Neonatologia: ['Icterícia neonatal', 'Reanimação neonatal'],
    Infectologia: ['Doenças exantemáticas', 'Meningites'],
    Pneumologia: ['Bronquiolite', 'Asma na infância'],
    Geral: ['Crescimento e desenvolvimento', 'Imunização', 'Aleitamento materno', 'Diarreia e desidratação'],
  },
  'Ginecologia e Obstetrícia': {
    Obstetrícia: ['Pré-natal', 'Diabetes gestacional', 'Pré-eclâmpsia e eclâmpsia', 'Hemorragias da primeira metade da gestação', 'Trabalho de parto', 'Puerpério'],
    Ginecologia: ['Sangramento uterino anormal', 'Câncer de colo do útero', 'Contracepção'],
  },
  Preventiva: {
    Epidemiologia: ['Medidas de frequência', 'Testes diagnósticos', 'Estudos epidemiológicos'],
    SUS: ['Princípios e diretrizes do SUS', 'Atenção primária à saúde'],
    Vigilância: ['Vigilância em saúde', 'Notificação compulsória'], Ética: ['Ética médica'],
  },
  Psiquiatria: {
    'Transtornos do humor': ['Depressão', 'Transtorno bipolar'], Psicoses: ['Esquizofrenia'],
    Ansiedade: ['Transtornos de ansiedade'], Substâncias: ['Álcool e outras drogas'],
  },
}
