import { useEffect, useRef, useState } from 'react'
import { Activity, Archive, ArrowDownToLine, ArrowUpRight, Bell, BookOpen, Check, ChevronDown, CircleHelp, Clock3, FilePlus2, Filter, FolderKanban, Grid2X2, LayoutDashboard, MessageCircle, MoreHorizontal, Plus, Search, Settings, ShieldCheck, Sparkles, Users, X } from 'lucide-react'
import { loadCanvas, saveCanvas, subscribeToCanvas } from './lib/canvasRepository'
import './App.css'

type Note = { id: number; text: string; author: string; color: string; status?: 'done' | 'review' }
type CanvasBlock = { id: string; title: string; question: string; tone: string; notes: Note[] }

const initialBlocks: CanvasBlock[] = [
  { id: 'why', title: 'Justificativas', question: 'POR QUE?', tone: 'coral', notes: [{ id: 1, text: 'Reduzir o tempo gasto na montagem e atualização dos planos de projeto.', author: 'AS', color: 'mint', status: 'done' }, { id: 2, text: 'Criar uma linguagem comum entre áreas e patrocinadores.', author: 'MR', color: 'yellow' }] },
  { id: 'objectives', title: 'Objetivos SMART', question: 'POR QUE?', tone: 'coral', notes: [{ id: 3, text: 'Ter 80% dos projetos estratégicos validados pela equipe até dezembro.', author: 'AS', color: 'lavender', status: 'review' }, { id: 4, text: 'Dar visibilidade às decisões em uma única página.', author: 'LC', color: 'peach' }] },
  { id: 'benefits', title: 'Benefícios', question: 'POR QUE?', tone: 'coral', notes: [{ id: 5, text: 'Alinhamento rápido entre quem decide e quem executa.', author: 'MR', color: 'mint' }, { id: 6, text: 'Menos retrabalho durante a execução.', author: 'AS', color: 'yellow' }] },
  { id: 'product', title: 'Produto', question: 'O QUE?', tone: 'gold', notes: [{ id: 7, text: 'Workspace colaborativo para criar, revisar e publicar canvases.', author: 'LC', color: 'blue', status: 'done' }] },
  { id: 'requirements', title: 'Requisitos', question: 'O QUE?', tone: 'gold', notes: [{ id: 8, text: 'Edição por cartões, comentários, versões e exportação PDF.', author: 'AS', color: 'peach' }, { id: 9, text: 'Acesso seguro por organização e por projeto.', author: 'MR', color: 'mint' }] },
  { id: 'stakeholders', title: 'Stakeholders externos', question: 'QUEM?', tone: 'teal', notes: [{ id: 10, text: 'Diretoria e patrocinadores do portfólio.', author: 'LC', color: 'lavender' }, { id: 11, text: 'Áreas parceiras e clientes convidados.', author: 'MR', color: 'yellow' }] },
  { id: 'team', title: 'Equipe', question: 'QUEM?', tone: 'teal', notes: [{ id: 12, text: 'PMO, gerentes de projeto, produto e especialistas.', author: 'AS', color: 'blue' }] },
  { id: 'assumptions', title: 'Premissas', question: 'COMO?', tone: 'blue', notes: [{ id: 13, text: 'A organização já utiliza e-mail corporativo.', author: 'MR', color: 'mint' }, { id: 14, text: 'As decisões devem ser revisadas mensalmente.', author: 'AS', color: 'peach' }] },
  { id: 'deliverables', title: 'Grupo de entregas', question: 'COMO?', tone: 'blue', notes: [{ id: 15, text: 'MVP web, templates, governança e trilha de auditoria.', author: 'LC', color: 'yellow', status: 'review' }] },
  { id: 'constraints', title: 'Restrições', question: 'COMO?', tone: 'blue', notes: [{ id: 16, text: 'Primeira versão deve funcionar sem treinamento formal.', author: 'AS', color: 'lavender' }] },
  { id: 'risks', title: 'Riscos', question: 'COMO?', tone: 'blue', notes: [{ id: 17, text: 'Baixa adesão de áreas acostumadas a planilhas.', author: 'MR', color: 'peach', status: 'review' }, { id: 18, text: 'Escopo crescer antes da validação do MVP.', author: 'LC', color: 'coral' }] },
  { id: 'timeline', title: 'Linha do tempo', question: 'QUANDO?', tone: 'purple', notes: [{ id: 19, text: 'Descoberta: 2 semanas · MVP: 12 semanas · Piloto: 4 semanas.', author: 'AS', color: 'blue' }] },
  { id: 'costs', title: 'Custos', question: 'QUANTO?', tone: 'purple', notes: [{ id: 20, text: 'Orçamento inicial reservado para produto e infraestrutura.', author: 'LC', color: 'mint' }] },
]

const navItems = [{ label: 'Visão geral', icon: LayoutDashboard }, { label: 'Meus projetos', icon: FolderKanban, count: '8' }, { label: 'Templates', icon: Grid2X2 }, { label: 'Equipe', icon: Users }]

function App() {
  const [blocks, setBlocks] = useState<CanvasBlock[]>(() => {
    const stored = localStorage.getItem('projectly-canvas-blocks')
      return stored ? JSON.parse(stored) as CanvasBlock[] : initialBlocks
  })
  const [isHydrated, setIsHydrated] = useState(false)
  const [activeNav, setActiveNav] = useState('Meus projetos')
  const [selectedBlock, setSelectedBlock] = useState('why')
  const [search, setSearch] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const [editingNote, setEditingNote] = useState<{ blockId: string; note: Note } | null>(null)
  const [newNote, setNewNote] = useState('')
  const [showComments, setShowComments] = useState(false)
  const [comments, setComments] = useState<string[]>(() => JSON.parse(localStorage.getItem('projectly-comments') ?? '[]') as string[])
  const [newComment, setNewComment] = useState('')
  const [showFilters, setShowFilters] = useState(false)
  const [activeFilter, setActiveFilter] = useState<'all' | 'review' | 'done'>('all')
  const [showActivity, setShowActivity] = useState(false)
  const [projectStatus, setProjectStatus] = useState(() => localStorage.getItem('projectly-project-status') ?? 'EM VALIDAÇÃO')
  const [version, setVersion] = useState(() => Number(localStorage.getItem('projectly-project-version') ?? '1.4'))
  const [projectName, setProjectName] = useState(() => localStorage.getItem('projectly-project-name') ?? 'Canvas de Plataforma PMO')
  const [managerName, setManagerName] = useState(() => localStorage.getItem('projectly-manager-name') ?? 'Ana Souza')
  const [realtimeStatus, setRealtimeStatus] = useState<'online' | 'offline'>('offline')
  const skipNextRemoteSave = useRef(false)
  const filteredBlocks = blocks.map((block) => ({ ...block, notes: block.notes.filter((note) => note.text.toLowerCase().includes(search.toLowerCase()) && (activeFilter === 'all' || note.status === activeFilter)) })).filter((block) => activeFilter === 'all' || block.notes.length > 0)
  useEffect(() => {
    document.querySelector('.canvas-grid')?.setAttribute('data-manager', managerName)
    document.querySelector('.canvas-grid')?.setAttribute('data-project', projectName)
    const projectTitle = document.querySelector('.project-heading h1')
    if (projectTitle) projectTitle.textContent = projectName
    const breadcrumb = document.querySelector('.breadcrumbs b')
    if (breadcrumb) breadcrumb.textContent = projectName
  }, [projectName, managerName])
  useEffect(() => {
    let isMounted = true
    loadCanvas().then((remoteCanvas) => {
      if (isMounted && remoteCanvas) {
        setBlocks(remoteCanvas.blocks as CanvasBlock[])
        setProjectStatus(remoteCanvas.status)
        setVersion(remoteCanvas.version)
        if (remoteCanvas.project_name) setProjectName(remoteCanvas.project_name)
        if (remoteCanvas.manager_name) setManagerName(remoteCanvas.manager_name)
      }
      if (isMounted) setIsHydrated(true)
    })
    const unsubscribe = subscribeToCanvas((remoteCanvas) => {
      skipNextRemoteSave.current = true
      setBlocks(remoteCanvas.blocks as CanvasBlock[])
      setProjectStatus(remoteCanvas.status)
      setVersion(remoteCanvas.version)
      if (remoteCanvas.project_name) setProjectName(remoteCanvas.project_name)
      if (remoteCanvas.manager_name) setManagerName(remoteCanvas.manager_name)
    }, setRealtimeStatus)
    return () => { isMounted = false; unsubscribe() }
  }, [])
  useEffect(() => {
    if (!isHydrated) return
    if (skipNextRemoteSave.current) {
      skipNextRemoteSave.current = false
      return
    }
    localStorage.setItem('projectly-canvas-blocks', JSON.stringify(blocks))
    localStorage.setItem('projectly-project-status', projectStatus)
    localStorage.setItem('projectly-project-version', version.toFixed(1))
    localStorage.setItem('projectly-project-name', projectName)
    localStorage.setItem('projectly-manager-name', managerName)
    void saveCanvas({ blocks, status: projectStatus, version, project_name: projectName, manager_name: managerName })
  }, [blocks, projectStatus, version, projectName, managerName, isHydrated])
  useEffect(() => {
    const handleNoteClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement
      const noteElement = target.closest('.note')
      const blockElement = target.closest('.canvas-block')
      if (!noteElement || !blockElement) return
      const blockTitle = blockElement.querySelector('h3')?.textContent
      const noteText = noteElement.querySelector('p')?.textContent
      const block = blocks.find((item) => item.title === blockTitle)
      const note = block?.notes.find((item) => item.text === noteText)
      if (block && note) setEditingNote({ blockId: block.id, note: { ...note } })
    }
    document.addEventListener('click', handleNoteClick)
    return () => document.removeEventListener('click', handleNoteClick)
  }, [blocks])
  useEffect(() => { localStorage.setItem('projectly-comments', JSON.stringify(comments)) }, [comments])
  function addComment() {
    if (!newComment.trim()) return
    setComments((current) => [...current, newComment.trim()])
    setNewComment('')
  }
  function exportCanvas() {
    const payload = JSON.stringify({ project: projectName, manager: managerName, status: projectStatus, version, blocks, comments }, null, 2)
    const file = new Blob([payload], { type: 'application/json' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(file)
    link.download = `canvas-pmo-v${version.toFixed(1)}.json`
    link.click()
    URL.revokeObjectURL(link.href)
  }
  function addNote() {
    if (!newNote.trim()) return
    setBlocks((current) => current.map((block) => block.id === selectedBlock ? { ...block, notes: [...block.notes, { id: Date.now(), text: newNote.trim(), author: 'AS', color: 'yellow' }] } : block))
    setNewNote(''); setIsAdding(false)
  }
  function saveEditedNote() {
    if (!editingNote || !editingNote.note.text.trim()) return
    setBlocks((current) => current.map((block) => block.id === editingNote.blockId
      ? { ...block, notes: block.notes.map((note) => note.id === editingNote.note.id ? editingNote.note : note) }
      : block))
    setEditingNote(null)
  }
  function deleteEditedNote() {
    if (!editingNote) return
    setBlocks((current) => current.map((block) => block.id === editingNote.blockId
      ? { ...block, notes: block.notes.filter((note) => note.id !== editingNote.note.id) }
      : block))
    setEditingNote(null)
  }

  return (
    <div className="app-shell">
      <aside className="sidebar"><div className="brand"><span className="brand-mark">P</span><span>projectly</span></div><div className="workspace-switcher"><span className="workspace-avatar">N</span><span><b>Núcleo de Projetos</b><small>Workspace principal</small></span><ChevronDown size={15} /></div><nav className="main-nav" aria-label="Navegação principal"><span className="nav-caption">WORKSPACE</span>{navItems.map(({ label, icon: Icon, count }) => <button key={label} className={activeNav === label ? 'nav-item active' : 'nav-item'} onClick={() => setActiveNav(label)}><Icon size={17} /><span>{label}</span>{count && <em>{count}</em>}</button>)}<span className="nav-caption nav-caption-spaced">GESTÃO</span><button className="nav-item"><Activity size={17} /><span>Atividade</span><i className="unread-dot" /></button><button className="nav-item"><Archive size={17} /><span>Arquivados</span></button></nav><div className="sidebar-bottom"><div className="upgrade-card"><Sparkles size={16} /><div><strong>Plano Team</strong><small>7 de 10 projetos ativos</small></div><ArrowUpRight size={14} /></div><button className="nav-item"><Settings size={17} /><span>Configurações</span></button><div className="user-card"><span className="avatar">AS</span><span><b>Ana Souza</b><small>Administrador</small></span><MoreHorizontal size={16} /></div></div></aside>
      <main className="main-content"><header className="topbar"><div className="breadcrumbs"><span>Meus projetos</span><span>/</span><b>Canvas de Plataforma PMO</b></div><div className="top-actions"><button className="icon-button" title="Ajuda"><CircleHelp size={18} /></button><button className="icon-button notification" title="Notificações"><Bell size={18} /><i /></button><span className="top-avatar">AS</span></div></header><div className="page-content"><section className="project-heading"><div><div className="eyebrow"><span className="status-dot" /> {projectStatus} <span className="updated">Salvo há 2 min</span></div><h1>Canvas de Plataforma PMO</h1><p>Uma visão compartilhada para transformar ideias em projetos alinhados.</p></div><div className="heading-actions"><button className="secondary-button" onClick={() => { setVersion((current) => Number((current + 0.1).toFixed(1))); setProjectStatus('RASCUNHO') }}><FilePlus2 size={16} /> Nova versão</button><button className="primary-button" onClick={() => setProjectStatus('APROVADO')}><Check size={16} /> {projectStatus === 'APROVADO' ? 'Canvas aprovado' : 'Enviar para aprovação'}</button></div></section><section className="meta-row"><div className="people"><div className="avatar-stack"><span className="avatar-stack-item teal">AS</span><span className="avatar-stack-item orange">MR</span><span className="avatar-stack-item purple">LC</span><span className="avatar-stack-item more">+3</span></div><span>6 colaboradores</span><button className="tiny-link"><Plus size={14} /> convidar</button></div><div className="meta-items"><span><Clock3 size={15} /> revisão em 12 dias</span><span className="divider" /><button className={showComments ? 'meta-button active' : 'meta-button'} onClick={() => setShowComments(!showComments)}><MessageCircle size={15} /> 4 comentários</button><span className="divider" /><button className="meta-button"><ShieldCheck size={15} /> versão {version.toFixed(1)}</button></div></section>{showComments && <aside className="comments-panel"><div><span className="canvas-kicker">DISCUSSÃO ATIVA</span><strong>Comentários do canvas</strong></div><p><b>MR</b> “Podemos validar o objetivo com o time de operações antes da publicação?”</p><p><b>LC</b> “O risco de adesão precisa de um responsável explícito.”</p></aside>}<div className="toolbar"><div className="view-tabs"><button className={showActivity ? 'view-tab' : 'view-tab active'} onClick={() => setShowActivity(false)}><BookOpen size={15} /> Canvas</button><button className={showActivity ? 'view-tab active' : 'view-tab'} onClick={() => setShowActivity(true)}><Activity size={15} /> Atividade <span className="tab-count">12</span></button></div><div className="toolbar-actions"><div className="search-field"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Buscar no canvas" /></div><div className="filter-wrap"><button className={showFilters ? 'filter-button active' : 'filter-button'} onClick={() => setShowFilters(!showFilters)}><Filter size={15} /> Filtros</button>{showFilters && <div className="filter-menu"><span>FILTRAR NOTAS</span>{(['all', 'review', 'done'] as const).map((filter) => <button key={filter} className={activeFilter === filter ? 'filter-option selected' : 'filter-option'} onClick={() => { setActiveFilter(filter); setShowFilters(false) }}>{filter === 'all' ? 'Todas as notas' : filter === 'review' ? 'Em revisão' : 'Validadas'}{activeFilter === filter && <Check size={13} />}</button>)}</div>}</div><button className="icon-button"><MoreHorizontal size={18} /></button></div></div>{showActivity ? <section className="activity-panel"><div className="activity-heading"><div><span className="canvas-kicker">HISTÓRICO DO PROJETO</span><h2>Atividade recente</h2></div><span className="activity-count">12 eventos</span></div>{['Ana Souza criou a versão 1.4', 'Marcos Ribeiro comentou em Objetivos SMART', 'Lucas Costa validou o bloco Produto', 'Ana Souza adicionou uma nota em Riscos', 'Marcos Ribeiro entrou no projeto'].map((event, index) => <div className="activity-item" key={event}><span className={`activity-icon ${index % 2 ? 'sand' : 'green'}`}>{index % 2 ? <MessageCircle size={14} /> : <Activity size={14} />}</span><div><strong>{event}</strong><small>{index + 1} {index === 0 ? 'hora' : 'horas'} atrás · versão 1.4</small></div></div>)}</section> : <div className="canvas-wrap"><div className="canvas-intro"><div><span className="canvas-kicker">MODELO DE PROJETO</span><h2>Project Model Canvas <span>·</span> <small>rascunho compartilhado</small></h2></div><div className="canvas-legend"><span><i className="legend-dot verified" /> validado</span><span><i className="legend-dot review" /> em revisão</span></div></div><div className="canvas-grid">{filteredBlocks.map((block) => <article key={block.id} className={`canvas-block ${block.tone} ${selectedBlock === block.id ? 'selected' : ''}`} onClick={() => setSelectedBlock(block.id)}><div className="block-header"><div><span className="question-label">{block.question}</span><h3>{block.title}</h3></div><button className="block-menu" onClick={(event) => event.stopPropagation()}><MoreHorizontal size={16} /></button></div><div className="notes-list">{block.notes.map((note) => <div className={`note ${note.color}`} key={note.id}><p>{note.text}</p><div className="note-footer"><span className="note-author">{note.author}</span>{note.status === 'done' && <Check size={13} className="note-check" />}{note.status === 'review' && <span className="review-label">revisar</span>}</div></div>)}{block.notes.length === 0 && <span className="empty-search">Nenhuma nota encontrada</span>}</div><button className="add-note" onClick={(event) => { event.stopPropagation(); setSelectedBlock(block.id); setIsAdding(true) }}><Plus size={14} /> adicionar nota</button></article>)}</div><div className="canvas-footer"><span><span className="pulse-dot" /> {realtimeStatus === 'online' ? 'Sincronização online' : 'Modo local'}</span><span>Última publicação por Ana Souza · hoje, 09:42</span></div></div>}</div></main>
      <button className="export-button" onClick={exportCanvas} title="Baixar backup do canvas"><ArrowDownToLine size={15} /> Exportar backup</button>
      {showComments && <aside className="comment-composer"><div className="comment-composer-header"><span><MessageCircle size={15} /> Adicionar comentário</span><button className="icon-button" onClick={() => setShowComments(false)}><X size={15} /></button></div><div className="comment-list">{comments.map((comment, index) => <p key={`${comment}-${index}`}><b>AS</b>{comment}</p>)}</div><textarea value={newComment} onChange={(event) => setNewComment(event.target.value)} placeholder="Escreva uma observação para a equipe..." /><button className="primary-button comment-submit" onClick={addComment}><MessageCircle size={15} /> Comentar</button></aside>}
      {editingNote && <div className="composer-backdrop" onClick={() => setEditingNote(null)}><div className="composer" onClick={(event) => event.stopPropagation()}><button className="composer-close" onClick={() => setEditingNote(null)}><X size={17} /></button><span className="canvas-kicker">EDITAR NOTA</span><h2>{blocks.find((block) => block.id === editingNote.blockId)?.title}</h2><textarea autoFocus value={editingNote.note.text} onChange={(event) => setEditingNote({ ...editingNote, note: { ...editingNote.note, text: event.target.value } })} /><div className="note-status-editor"><span>STATUS DA NOTA</span><button className={editingNote.note.status === 'review' || !editingNote.note.status ? 'status-choice selected' : 'status-choice'} onClick={() => setEditingNote({ ...editingNote, note: { ...editingNote.note, status: 'review' } })}>Em revisão</button><button className={editingNote.note.status === 'done' ? 'status-choice selected done' : 'status-choice'} onClick={() => setEditingNote({ ...editingNote, note: { ...editingNote.note, status: 'done' } })}>Validada</button></div><div className="composer-actions"><button className="danger-button" onClick={deleteEditedNote}>Excluir</button><button className="secondary-button" onClick={() => setEditingNote(null)}>Cancelar</button><button className="primary-button" onClick={saveEditedNote}><Check size={16} /> Salvar nota</button></div></div></div>}
      {isAdding && <div className="composer-backdrop" onClick={() => setIsAdding(false)}><div className="composer" onClick={(event) => event.stopPropagation()}><button className="composer-close" onClick={() => setIsAdding(false)}><X size={17} /></button><span className="canvas-kicker">NOVA NOTA</span><h2>{blocks.find((block) => block.id === selectedBlock)?.title}</h2><textarea autoFocus value={newNote} onChange={(event) => setNewNote(event.target.value)} placeholder="Escreva uma ideia curta e objetiva..." /><div className="composer-actions"><button className="secondary-button" onClick={() => setIsAdding(false)}>Cancelar</button><button className="primary-button" onClick={addNote}><Plus size={16} /> Adicionar nota</button></div></div></div>}
    </div>
  )
}

export default App
