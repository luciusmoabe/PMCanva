# Plano de solucao SaaS para Project Model Canvas

## 1. Visao

Criar uma plataforma SaaS multi-organizacao para que equipes montem, discutam, validem, versionem e apresentem seus Project Model Canvas. O produto deve preservar a simplicidade visual e a dinamica colaborativa do canvas em papel, acrescentando recursos digitais de rastreabilidade, governanca e integracao.

O canvas nao sera apenas um formulario. Cada projeto tera um modelo vivo, com blocos editaveis, evidencia das decisoes, responsaveis, historico e status de validacao.

## 2. Status atual do desenvolvimento

Situacao registrada em 19/08/2026. O que existe hoje e um prototipo funcional de front-end que valida a experiencia visual do canvas, ainda sem a base de SaaS (autenticacao, organizacoes, papeis, versionamento real). Serve como prova de conceito da Fase 0/inicio da Fase 1, nao como MVP completo.

**Stack em uso**

- Front-end: React 19 + TypeScript + Vite, em um unico componente (`app/src/App.tsx`), sem roteador.
- Icones: lucide-react.
- Persistencia e tempo real: Supabase (Postgres + Realtime), acessado direto do navegador via `@supabase/supabase-js`, sem camada de API propria.
- Sem backend dedicado, sem fila, sem storage de arquivos, sem observabilidade alem de `console.warn`.

**O que ja funciona**

- Os 13 blocos do Project Model Canvas, agrupados pelas 5 perguntas do metodo e posicionados no layout classico do livro.
- Cartoes/notas: criar, editar, excluir, marcar como "validada" ou "em revisao", busca por texto e filtro por status.
- Um canvas de demonstracao (`canvas_key = 'projectly-demo-canvas'`) persiste no Supabase e sincroniza em tempo real entre abas/navegadores via um canal Realtime fixo.
- Exportacao de um backup em JSON do canvas (blocos, comentarios, metadados).
- Selecao e criacao de "projetos" no cabecalho (lista guardada no navegador).

**Lacunas criticas em relacao ao plano**

- Nao ha autenticacao, organizacoes, membros nem papeis (secao 4.1 inteira ainda nao comecou). O usuario "Ana Souza" exibido na interface e fixo, nao vem de login.
- Multi-tenancy nao existe: as policies de RLS do Supabase liberam leitura/escrita apenas para o registro literal `projectly-demo-canvas` (`supabase/schema.sql`). Projetos criados pela interface alem do demo **nao persistem no Supabase** — caem silenciosamente para `localStorage` (o erro so aparece como aviso no console), entao nao sao compartilhados entre usuarios ou dispositivos.
- Comentarios sao uma lista unica por projeto salva so em `localStorage`, sem vinculo com nota/bloco, sem mencoes, sem resolucao e sem sincronizacao entre usuarios.
- "Versao" e apenas um numero decimal incrementado por um botao; nao ha snapshot imutavel, historico nem comparacao entre versoes.
- "Aprovar" e um unico botao que muda o status do projeto; nao existe aprovacao por bloco, por stakeholder, nem evento de auditoria associado.
- O painel de "Atividade" mostra uma lista fixa de eventos ilustrativos — nao e um log real de auditoria.
- Exportacao gera apenas JSON; falta PDF e PNG previstos no MVP.
- Nao ha convites externos, sessao facilitada, presenca de colaboradores, nem qualquer integracao externa.

Em resumo: o front-end do canvas e a base de dados/tempo real estao encaminhados; a parte de identidade, multi-tenancy, governanca e auditoria — que sustenta o modelo SaaS — ainda precisa ser construida do zero.

## 3. Fundamentos do metodo

A experiencia deve seguir a logica do Project Model Canvas apresentada no livro de Jose Finocchio Junior:

- **Por que?** Justificativas, objetivos e beneficios.
- **O que?** Produto e requisitos.
- **Quem?** Stakeholders externos e equipe do projeto.
- **Como?** Premissas, grupo de entregas, restricoes e riscos.
- **Quando e quanto?** Linha do tempo e custos.

O sistema deve favorecer a construcao coletiva, a visualizacao do todo e a verificacao de coerencia entre os blocos. O preenchimento deve permitir partir de ideias curtas e evoluir para um plano validado, sem transformar o canvas em um documento burocratico.

## 4. Usuarios e papeis

- **Administrador da organizacao:** plano contratado, usuarios, permissoes, identidade visual e configuracoes.
- **Gerente de projetos:** cria canvas, conduz sessoes, controla versoes e publica o modelo.
- **Colaborador:** edita blocos autorizados, sugere alteracoes e participa das sessoes.
- **Stakeholder convidado:** comenta, responde perguntas e aprova ou rejeita uma versao, sem acesso ao restante da organizacao.
- **Leitor:** consulta projetos publicados e exporta relatorios conforme permissao.

Cada organizacao deve possuir papeis configuraveis, grupos e escopos de acesso por projeto.

*Nenhum destes papeis existe hoje como conceito de dados — a interface exibe um unico usuario fixo ("Ana Souza / Administrador"). Ver secao 2.*

## 5. Escopo funcional do MVP

### 5.1 Organizacoes e acesso

- [PENDENTE] Cadastro da organizacao e convite de usuarios por e-mail.
- [PENDENTE] Login, recuperacao de acesso, MFA opcional e sessoes revogaveis.
- [PENDENTE] Multi-tenancy com isolamento rigoroso por `organization_id`. A RLS atual libera apenas o registro de demonstracao, sem isolamento real entre projetos ou usuarios.
- [PENDENTE] Papeis: administrador, editor, comentarista e leitor.

### 5.2 Projetos e canvas

- [PARCIAL] Criacao de projeto a partir de canvas em branco ou template — cria em branco com um conjunto fixo de notas de exemplo; nao ha templates de fato.
- [FEITO] Os 13 blocos do Project Model Canvas, agrupados pelas perguntas do metodo, no layout classico.
- [PARCIAL] Edicao de cartoes/notas com texto curto, autor e status (validada/em revisao) — autor e sempre as iniciais fixas "AS"; sem data, etiqueta livre ou responsavel dedicado.
- [PARCIAL] Busca e filtro por status — reordenacao, fixacao e arquivamento de notas ainda nao existem.
- [PENDENTE] Campos de apoio: objetivo SMART, indicador, fonte da evidencia e data de revisao.
- [PENDENTE] Destaque de blocos vazios, notas sem responsavel e dependencias nao validadas.

### 5.3 Colaboracao

- [PARCIAL] Edicao concorrente — sincronizacao via Supabase Realtime (ultima escrita vence, sem presenca nem resolucao de conflito) e funciona apenas para o canvas de demonstracao.
- [PARCIAL] Comentarios — existe um painel, mas e uma lista unica por projeto, sem vinculo com nota/bloco, sem mencoes ou resolucao, salva apenas no `localStorage` do navegador.
- [PENDENTE] Sessao facilitada com pauta, cronometro, fases de ideacao, agrupamento e validacao.
- [PENDENTE] Convite por link com expiracao e permissao limitada.
- [PENDENTE] Registro de quem criou, alterou ou validou cada decisao — o painel "Atividade" hoje mostra eventos fixos ilustrativos, nao um log real.

### 5.4 Governanca e saidas

- [PARCIAL] Status do projeto — um botao alterna entre RASCUNHO, EM VALIDACAO e APROVADO; faltam "em execucao" e "arquivado", e nao ha fluxo de aprovacao por pessoa.
- [PARCIAL] Versionamento — existe um numero de versao que incrementa a cada clique; nao ha snapshot imutavel nem comparacao entre versoes.
- [PENDENTE] Aprovacao por bloco ou do canvas completo — hoje e um clique global e simbolico.
- [PARCIAL] Exportacao — gera um JSON de backup; faltam PDF, PNG e documento estruturado.
- [PENDENTE] Link de leitura somente para versoes publicadas.
- [PENDENTE] Painel com projetos, status, ultima revisao, riscos altos e aprovacoes pendentes — hoje existe apenas o seletor de projetos no cabecalho.

## 6. Fluxo principal

1. O gerente cria o projeto, informa nome, patrocinador, objetivo e equipe.
2. A plataforma apresenta os blocos vazios organizados pelas perguntas do canvas.
3. A equipe realiza uma sessao colaborativa, criando notas curtas e associando autores.
4. O facilitador agrupa ideias, registra conflitos e marca blocos que precisam de evidencia.
5. O gerente completa dependencias, riscos, prazos e custos e envia uma versao para validacao.
6. Stakeholders comentam e aprovam ou rejeitam os pontos sob sua responsabilidade.
7. Uma versao aprovada fica publicada; novas mudancas abrem uma nova versao sem apagar a anterior.
8. O canvas aprovado e exportado e pode alimentar a execucao do projeto.

## 7. Regras de negocio essenciais

- Nenhum usuario pode consultar ou alterar dados de outra organizacao.
- Versoes aprovadas nao podem ser sobrescritas.
- Toda alteracao em nota ou campo relevante gera evento de auditoria.
- Uma aprovacao pertence a uma versao especifica e perde validade quando essa versao muda.
- Um risco deve ter probabilidade, impacto, resposta e responsavel para ser considerado tratado.
- Um requisito deve poder ser associado a pelo menos um grupo de entregas.
- O objetivo deve aceitar indicador, valor-alvo e prazo, preservando a verificabilidade do objetivo SMART.
- Convites externos devem ter validade, escopo e possibilidade de revogacao.

## 8. Arquitetura proposta

### 8.1 Componentes

- **Frontend web:** React com TypeScript, editor de canvas responsivo e atualizacao em tempo real. *Em uso: React 19 + TypeScript + Vite, ainda em um unico componente monolitico, sem roteador nem gerenciamento de estado dedicado.*
- **API:** backend modular REST ou GraphQL, com autorizacao centralizada e validacao de comandos. *Ainda nao existe: o front-end fala direto com o Supabase.*
- **Tempo real:** WebSocket com protocolo de presenca e sincronizacao; usar CRDT ou controle otimista com revisao de conflitos. *Em uso: Supabase Realtime (`postgres_changes`) sobre um unico canal fixo, sem presenca e com "ultima escrita vence".*
- **Banco transacional:** PostgreSQL para organizacoes, usuarios, projetos, versoes, blocos, notas, comentarios e aprovacoes. *Em uso: Supabase Postgres com uma unica tabela (`project_canvases`) e RLS restrita ao registro de demonstracao; nenhuma das outras entidades existe ainda.*
- **Arquivos:** armazenamento S3 compativel para exportacoes, anexos e imagens. *Nao iniciado.*
- **Fila:** Redis ou servico gerenciado para exportacao, notificacoes e tarefas demoradas. *Nao iniciado.*
- **Identidade:** provedor OIDC/SAML no plano corporativo; e-mail e MFA no plano inicial. *Nao iniciado — Supabase Auth ainda nao esta habilitado.*
- **Observabilidade:** logs estruturados, metricas, tracing e auditoria com retencao configuravel. *Nao iniciado — hoje so ha `console.warn` em falhas de leitura/escrita no Supabase.*

### 8.2 Modelo de dados minimo

- `organizations`, `users`, `memberships`, `roles`
- `projects`, `project_members`, `templates`
- `canvases`, `canvas_versions`, `canvas_blocks`, `notes`
- `comments`, `mentions`, `approvals`, `audit_events`
- `risks`, `deliverables`, `requirements`, `stakeholders`
- `subscriptions`, `usage_counters`, `exports`, `invitations`

Recomenda-se guardar o snapshot completo da versao publicada e os eventos de alteracao separadamente. Isso simplifica comparacao, auditoria e restauracao sem sacrificar a consulta do estado atual.

*Nenhuma dessas tabelas existe ainda. O schema atual (`supabase/schema.sql`) tem apenas `project_canvases`, com os blocos guardados como um unico campo `jsonb` — util para o prototipo, mas incompativel com versionamento, auditoria e consultas granulares descritas acima. Migrar para o modelo relacional completo e pre-requisito para a Fase 1 real.*

## 9. Seguranca e requisitos nao funcionais

- Autorizacao em toda consulta e mutacao, com testes de isolamento entre tenants.
- Criptografia em transito e em repouso; segredos fora do repositorio.
- MFA, politicas de senha, rate limiting e protecao contra abuso de links publicos.
- Backup automatico, restauracao testada e objetivo de disponibilidade definido por plano.
- LGPD: finalidade, minimizacao, exportacao e exclusao de dados pessoais, consentimento quando aplicavel e registro de operador/controlador.
- Acessibilidade WCAG 2.2 AA: teclado, foco visivel, contraste, leitor de tela e alternativa textual para o canvas visual.
- Responsividade para consulta e edicao leve em tablet; sessao completa de facilitação prioriza desktop.
- Metas iniciais: carregamento do canvas em menos de 2 s em P95, autosave confirmado em menos de 1 s e perda de dados igual a zero após confirmação.

*Nenhum destes itens foi verificado no prototipo atual: nao ha testes de isolamento (nao ha isolamento), nao ha MFA/rate limiting, e a acessibilidade nao foi auditada.*

## 10. Roadmap

### Fase 0 - Descoberta, 2 semanas

Validar com 3 a 5 organizacoes: tipos de projeto, processo de aprovacao, necessidade de templates, formato de exportacao e requisitos LGPD. Produzir prototipo navegavel e teste de uma sessao de canvas.

*Status: o prototipo navegavel do canvas existe (secao 2) e ja serve para essa validacao; as entrevistas com organizacoes-piloto ainda nao foram registradas neste plano.*

### Fase 1 - MVP, 8 a 12 semanas

Acesso multi-organizacao, projetos, 13 blocos, notas, comentarios, permissoes, autosave, versoes, aprovacao, exportacao PDF e painel basico.

*Status: em andamento. Feito — os 13 blocos, notas com autosave (via Supabase) e exportacao (em JSON, nao PDF). Nao comecado — acesso multi-organizacao, permissoes, comentarios sincronizados, versoes reais e painel de projetos. Esse e o gargalo atual: sem autenticacao e multi-tenancy, o restante do MVP nao pode ser considerado pronto para usuarios reais.*

### Fase 2 - Colaboracao avancada, 6 a 8 semanas

Edicao concorrente, presenca, sessao facilitada, notificacoes, templates por area, comparacao visual de versoes e convidados externos.

### Fase 3 - Gestao corporativa, 8 a 12 semanas

SSO SAML/OIDC, SCIM, trilha de auditoria avancada, retencao, dominios personalizados, API, webhooks, analytics de portfolio e governanca por departamento.

### Fase 4 - Integracoes e inteligencia assistiva

Integracoes com Jira, Azure DevOps, Trello, Teams e calendarios. Assistentes podem sugerir perguntas, detectar incoerencias e resumir decisoes, mas nunca alterar ou aprovar o canvas sem acao explicita de um usuario.

## 11. Criterios de aceite do MVP

- Dois usuarios da mesma organizacao editam um canvas e veem as alteracoes sem recarregar a pagina.
- Um usuario sem permissao nao consegue ler, exportar ou inferir dados de outro projeto.
- O gerente cria uma versao, envia para aprovacao, recebe comentario e publica a versao aprovada.
- O sistema exibe os 13 blocos com nomes e agrupamentos consistentes com o metodo.
- Uma versao publicada permanece acessivel mesmo depois de novas alteracoes no rascunho.
- PDF e PNG preservam a hierarquia visual e incluem identificacao da versao, data e participantes.
- Auditoria identifica autor, acao, horario e objeto alterado.
- O canvas pode ser usado por teclado e tem alternativa linear para tecnologias assistivas.

*Nenhum destes criterios esta atendido de forma completa hoje: a sincronizacao em tempo real funciona apenas no canvas de demonstracao, e nao ha isolamento por permissao, PDF/PNG, auditoria real nem verificacao de acessibilidade.*

## 12. Metricas de sucesso

- Tempo mediano para criar o primeiro canvas.
- Percentual de projetos que passam de rascunho para validacao.
- Tempo entre primeira versao e aprovacao.
- Numero de participantes ativos por sessao.
- Percentual de notas com responsavel e evidencia.
- Retencao de organizacoes e canvases revisados apos 30 e 90 dias.
- Incidentes de isolamento, perda de dados e falhas de exportacao.

## 13. Modelo comercial sugerido

- **Starter:** equipes pequenas, limite de projetos ativos e exportacoes.
- **Team:** colaboracao em tempo real, templates, convidados e historico ampliado.
- **Business:** SSO, auditoria, governanca, API e suporte com SLA.
- **Enterprise:** ambiente dedicado ou regionalizado, SCIM, politicas de retencao e contrato LGPD personalizado.

O limite comercial deve ser baseado em usuarios ativos, projetos ativos e armazenamento, evitando cobrar por cada nota criada e desestimular a colaboracao.

## 14. Proximos passos recomendados

Com o prototipo visual validado, os proximos passos de maior impacto para destravar a Fase 1 sao, em ordem sugerida:

1. Habilitar Supabase Auth (e-mail/senha ou magic link) e introduzir as tabelas `organizations`, `users`, `memberships` — sem isso, nenhuma regra de multi-tenancy pode ser implementada.
2. Substituir a tabela unica `project_canvases` (um JSONB por canvas) pelo modelo relacional minimo da secao 8.2, ao menos para `projects`, `canvases`, `canvas_versions` e `notes`.
3. Trocar as policies de demonstracao do `supabase/schema.sql` por policies baseadas em `auth.uid()` e membership de organizacao, e remover o fallback anonimo, conforme ja apontado em `SUPABASE-SETUP.md`.
4. Vincular comentarios e notas por `nota_id`/`bloco_id` no banco em vez de listas soltas em `localStorage`, para permitir sincronizacao real entre usuarios.
5. So depois disso investir em versionamento imutavel, aprovacao por bloco, exportacao PDF/PNG e auditoria — funcionalidades que dependem de identidade e dados relacionais para fazerem sentido.

## 15. Decisoes para iniciar o projeto

1. Definir se a primeira versao sera exclusiva para projetos internos ou tambem para consultorias com varios clientes.
2. Escolher o nivel de edicao concorrente do MVP: controle otimista simples ou CRDT desde o inicio.
3. Confirmar a politica de dados, residencia e retencao para clientes brasileiros.
4. Selecionar 3 organizacoes-piloto e medir uma sessao completa de construcao e aprovacao.
5. Aprovar o prototipo antes do desenvolvimento, com foco na leitura do canvas inteiro em uma unica tela.
6. Priorizar autenticacao e multi-tenancy antes de continuar investindo em recursos visuais do canvas — hoje o maior risco do projeto e a lacuna de identidade/isolamento descrita na secao 2, nao a experiencia do canvas em si.
