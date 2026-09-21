export type BlockMeta = { id: string; title: string; question: string; tone: string }

export const blockMeta: BlockMeta[] = [
  { id: 'why', title: 'Justificativas', question: 'POR QUE?', tone: 'coral' },
  { id: 'objectives', title: 'Objetivos SMART', question: 'POR QUE?', tone: 'coral' },
  { id: 'benefits', title: 'Benefícios', question: 'POR QUE?', tone: 'coral' },
  { id: 'product', title: 'Produto', question: 'O QUE?', tone: 'gold' },
  { id: 'requirements', title: 'Requisitos', question: 'O QUE?', tone: 'gold' },
  { id: 'stakeholders', title: 'Stakeholders externos', question: 'QUEM?', tone: 'teal' },
  { id: 'team', title: 'Equipe', question: 'QUEM?', tone: 'teal' },
  { id: 'assumptions', title: 'Premissas', question: 'COMO?', tone: 'blue' },
  { id: 'deliverables', title: 'Grupo de entregas', question: 'COMO?', tone: 'blue' },
  { id: 'constraints', title: 'Restrições', question: 'COMO?', tone: 'blue' },
  { id: 'risks', title: 'Riscos', question: 'COMO?', tone: 'blue' },
  { id: 'timeline', title: 'Linha do tempo', question: 'QUANDO?', tone: 'purple' },
  { id: 'costs', title: 'Custos', question: 'QUANTO?', tone: 'purple' },
]
