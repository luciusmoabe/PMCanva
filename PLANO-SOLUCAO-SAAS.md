# Plano de solucao SaaS para Project Model Canvas

## 1. Visao

Criar uma plataforma SaaS multi-organizacao para que equipes montem, discutam, validem, versionem e apresentem seus Project Model Canvas. O produto deve preservar a simplicidade visual e a dinamica colaborativa do canvas em papel, acrescentando recursos digitais de rastreabilidade, governanca e integracao.

O canvas nao sera apenas um formulario. Cada projeto tera um modelo vivo, com blocos editaveis, evidencia das decisoes, responsaveis, historico e status de validacao.

## 2. Fundamentos do metodo

A experiencia deve seguir a logica do Project Model Canvas apresentada no livro de Jose Finocchio Junior:

- **Por que?** Justificativas, objetivos e beneficios.
- **O que?** Produto e requisitos.
- **Quem?** Stakeholders externos e equipe do projeto.
- **Como?** Premissas, grupo de entregas, restricoes e riscos.
- **Quando e quanto?** Linha do tempo e custos.

O sistema deve favorecer a construcao coletiva, a visualizacao do todo e a verificacao de coerencia entre os blocos. O preenchimento deve permitir partir de ideias curtas e evoluir para um plano validado, sem transformar o canvas em um documento burocratico.

## 3. Usuarios e papeis

- **Administrador da organizacao:** plano contratado, usuarios, permissoes, identidade visual e configuracoes.
- **Gerente de projetos:** cria canvas, conduz sessoes, controla versoes e publica o modelo.
- **Colaborador:** edita blocos autorizados, sugere alteracoes e participa das sessoes.
- **Stakeholder convidado:** comenta, responde perguntas e aprova ou rejeita uma versao, sem acesso ao restante da organizacao.
- **Leitor:** consulta projetos publicados e exporta relatorios conforme permissao.

Cada organizacao deve possuir papeis configuraveis, grupos e escopos de acesso por projeto.

## 4. Escopo funcional do MVP

### 4.1 Organizacoes e acesso

- Cadastro da organizacao e convite de usuarios por e-mail.
- Login, recuperacao de acesso, MFA opcional e sessoes revogaveis.
- Multi-tenancy com isolamento rigoroso por `organization_id`.
- Papeis: administrador, editor, comentarista e leitor.

### 4.2 Projetos e canvas

- Criacao de projeto a partir de canvas em branco ou template.
- Os 13 blocos do Project Model Canvas, agrupados pelas perguntas do metodo.
- Edicao de cartoes/notas dentro de cada bloco, com texto curto, autor, data, etiqueta e responsavel.
- Reordenacao, fixacao, arquivamento e busca de notas.
- Campos de apoio sem poluir a tela: objetivo SMART, indicador, fonte da evidencia e data de revisao.
- Destaque de blocos vazios, notas sem responsavel e dependencias nao validadas.

### 4.3 Colaboracao

- Edicao concorrente com presenca dos participantes.
- Comentarios por nota e por bloco, mencoes e resolucao de comentarios.
- Sessao facilitada com pauta, cronometro, fases de ideacao, agrupamento e validacao.
- Convite por link com expiracao e permissao limitada.
- Registro de quem criou, alterou ou validou cada decisao.

### 4.4 Governanca e saidas

- Status do projeto: rascunho, em validacao, aprovado, em execucao, arquivado.
- Versionamento imutavel do canvas e comparacao entre versoes.
- Aprovacao por bloco ou do canvas completo.
- Exportacao em PDF, PNG e documento estruturado.
- Link de leitura somente para versoes publicadas.
- Painel com projetos, status, ultima revisao, riscos altos e aprovacoes pendentes.

## 5. Fluxo principal

1. O gerente cria o projeto, informa nome, patrocinador, objetivo e equipe.
2. A plataforma apresenta os blocos vazios organizados pelas perguntas do canvas.
3. A equipe realiza uma sessao colaborativa, criando notas curtas e associando autores.
4. O facilitador agrupa ideias, registra conflitos e marca blocos que precisam de evidencia.
5. O gerente completa dependencias, riscos, prazos e custos e envia uma versao para validacao.
6. Stakeholders comentam e aprovam ou rejeitam os pontos sob sua responsabilidade.
7. Uma versao aprovada fica publicada; novas mudancas abrem uma nova versao sem apagar a anterior.
8. O canvas aprovado e exportado e pode alimentar a execucao do projeto.

## 6. Regras de negocio essenciais

- Nenhum usuario pode consultar ou alterar dados de outra organizacao.
- Versoes aprovadas nao podem ser sobrescritas.
- Toda alteracao em nota ou campo relevante gera evento de auditoria.
- Uma aprovacao pertence a uma versao especifica e perde validade quando essa versao muda.
- Um risco deve ter probabilidade, impacto, resposta e responsavel para ser considerado tratado.
- Um requisito deve poder ser associado a pelo menos um grupo de entregas.
- O objetivo deve aceitar indicador, valor-alvo e prazo, preservando a verificabilidade do objetivo SMART.
- Convites externos devem ter validade, escopo e possibilidade de revogacao.

## 7. Arquitetura proposta

### 7.1 Componentes

- **Frontend web:** React com TypeScript, editor de canvas responsivo e atualizacao em tempo real.
- **API:** backend modular REST ou GraphQL, com autorizacao centralizada e validacao de comandos.
- **Tempo real:** WebSocket com protocolo de presenca e sincronizacao; usar CRDT ou controle otimista com revisao de conflitos.
- **Banco transacional:** PostgreSQL para organizacoes, usuarios, projetos, versoes, blocos, notas, comentarios e aprovacoes.
- **Arquivos:** armazenamento S3 compativel para exportacoes, anexos e imagens.
- **Fila:** Redis ou servico gerenciado para exportacao, notificacoes e tarefas demoradas.
- **Identidade:** provedor OIDC/SAML no plano corporativo; e-mail e MFA no plano inicial.
- **Observabilidade:** logs estruturados, metricas, tracing e auditoria com retencao configuravel.

### 7.2 Modelo de dados minimo

- `organizations`, `users`, `memberships`, `roles`
- `projects`, `project_members`, `templates`
- `canvases`, `canvas_versions`, `canvas_blocks`, `notes`
- `comments`, `mentions`, `approvals`, `audit_events`
- `risks`, `deliverables`, `requirements`, `stakeholders`
- `subscriptions`, `usage_counters`, `exports`, `invitations`

Recomenda-se guardar o snapshot completo da versao publicada e os eventos de alteracao separadamente. Isso simplifica comparacao, auditoria e restauracao sem sacrificar a consulta do estado atual.

## 8. Seguranca e requisitos nao funcionais

- Autorizacao em toda consulta e mutacao, com testes de isolamento entre tenants.
- Criptografia em transito e em repouso; segredos fora do repositorio.
- MFA, politicas de senha, rate limiting e protecao contra abuso de links publicos.
- Backup automatico, restauracao testada e objetivo de disponibilidade definido por plano.
- LGPD: finalidade, minimizacao, exportacao e exclusao de dados pessoais, consentimento quando aplicavel e registro de operador/controlador.
- Acessibilidade WCAG 2.2 AA: teclado, foco visivel, contraste, leitor de tela e alternativa textual para o canvas visual.
- Responsividade para consulta e edicao leve em tablet; sessao completa de facilitação prioriza desktop.
- Metas iniciais: carregamento do canvas em menos de 2 s em P95, autosave confirmado em menos de 1 s e perda de dados igual a zero após confirmação.

## 9. Roadmap

### Fase 0 - Descoberta, 2 semanas

Validar com 3 a 5 organizacoes: tipos de projeto, processo de aprovacao, necessidade de templates, formato de exportacao e requisitos LGPD. Produzir prototipo navegavel e teste de uma sessao de canvas.

### Fase 1 - MVP, 8 a 12 semanas

Acesso multi-organizacao, projetos, 13 blocos, notas, comentarios, permissoes, autosave, versoes, aprovacao, exportacao PDF e painel basico.

### Fase 2 - Colaboracao avancada, 6 a 8 semanas

Edicao concorrente, presenca, sessao facilitada, notificacoes, templates por area, comparacao visual de versoes e convidados externos.

### Fase 3 - Gestao corporativa, 8 a 12 semanas

SSO SAML/OIDC, SCIM, trilha de auditoria avancada, retencao, dominios personalizados, API, webhooks, analytics de portfolio e governanca por departamento.

### Fase 4 - Integracoes e inteligencia assistiva

Integracoes com Jira, Azure DevOps, Trello, Teams e calendarios. Assistentes podem sugerir perguntas, detectar incoerencias e resumir decisoes, mas nunca alterar ou aprovar o canvas sem acao explicita de um usuario.

## 10. Criterios de aceite do MVP

- Dois usuarios da mesma organizacao editam um canvas e veem as alteracoes sem recarregar a pagina.
- Um usuario sem permissao nao consegue ler, exportar ou inferir dados de outro projeto.
- O gerente cria uma versao, envia para aprovacao, recebe comentario e publica a versao aprovada.
- O sistema exibe os 13 blocos com nomes e agrupamentos consistentes com o metodo.
- Uma versao publicada permanece acessivel mesmo depois de novas alteracoes no rascunho.
- PDF e PNG preservam a hierarquia visual e incluem identificacao da versao, data e participantes.
- Auditoria identifica autor, acao, horario e objeto alterado.
- O canvas pode ser usado por teclado e tem alternativa linear para tecnologias assistivas.

## 11. Metricas de sucesso

- Tempo mediano para criar o primeiro canvas.
- Percentual de projetos que passam de rascunho para validacao.
- Tempo entre primeira versao e aprovacao.
- Numero de participantes ativos por sessao.
- Percentual de notas com responsavel e evidencia.
- Retencao de organizacoes e canvases revisados apos 30 e 90 dias.
- Incidentes de isolamento, perda de dados e falhas de exportacao.

## 12. Modelo comercial sugerido

- **Starter:** equipes pequenas, limite de projetos ativos e exportacoes.
- **Team:** colaboracao em tempo real, templates, convidados e historico ampliado.
- **Business:** SSO, auditoria, governanca, API e suporte com SLA.
- **Enterprise:** ambiente dedicado ou regionalizado, SCIM, politicas de retencao e contrato LGPD personalizado.

O limite comercial deve ser baseado em usuarios ativos, projetos ativos e armazenamento, evitando cobrar por cada nota criada e desestimular a colaboracao.

## 13. Decisoes para iniciar o projeto

1. Definir se a primeira versao sera exclusiva para projetos internos ou tambem para consultorias com varios clientes.
2. Escolher o nivel de edicao concorrente do MVP: controle otimista simples ou CRDT desde o inicio.
3. Confirmar a politica de dados, residencia e retencao para clientes brasileiros.
4. Selecionar 3 organizacoes-piloto e medir uma sessao completa de construcao e aprovacao.
5. Aprovar o prototipo antes do desenvolvimento, com foco na leitura do canvas inteiro em uma unica tela.
