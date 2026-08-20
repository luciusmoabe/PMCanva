# Plano de solucao SaaS para Project Model Canvas

## 1. Visao

Criar uma plataforma SaaS multi-organizacao para que equipes montem, discutam, validem, versionem e apresentem seus Project Model Canvas. O produto deve preservar a simplicidade visual e a dinamica colaborativa do canvas em papel, acrescentando recursos digitais de rastreabilidade, governanca e integracao.

O canvas nao sera apenas um formulario. Cada projeto tera um modelo vivo, com blocos editaveis, evidencia das decisoes, responsaveis, historico e status de validacao.

## 2. Status atual do desenvolvimento

Situacao registrada em 20/08/2026. O app agora tem autenticacao real e multi-tenancy de verdade: cada organizacao isola seus proprios projetos e notas via RLS do Supabase, validado ponta a ponta (cadastro, criacao de organizacao, criacao de projeto, notas em tempo real e isolamento entre duas organizacoes diferentes, tudo testado num navegador real). Isso fecha a lacuna que era o maior risco do projeto (ver revisao anterior desta secao). O que falta agora e sobretudo governanca (versionamento real, aprovacao, auditoria) e colaboracao avancada (convites, comentarios sincronizados), nao mais a fundacao de identidade.

**Stack em uso**

- Front-end: React 19 + TypeScript + Vite, sem roteador. `AuthGate.tsx` decide entre tela de login (`AuthScreen.tsx`), onboarding de organizacao (`OrgOnboarding.tsx`) e o app (`App.tsx`), que recebe sessao/organizacao/papel via props.
- Icones: lucide-react.
- Autenticacao: Supabase Auth, com e-mail+senha e link magico (OTP por e-mail).
- Persistencia e tempo real: Supabase (Postgres + Realtime), acessado direto do navegador via `@supabase/supabase-js`, ainda sem camada de API propria.
- Sem backend dedicado, sem fila, sem storage de arquivos, sem observabilidade alem de `console.warn` e um banner de erro na tela para falhas de escrita.

**O que ja funciona**

- Cadastro e login por e-mail+senha e por link magico; sessao gerenciada pelo Supabase Auth.
- Criacao de organizacao no primeiro acesso (`create_organization_with_owner`), que ja registra quem criou como `admin`.
- Multi-tenancy real: `organizations`, `memberships` (papeis admin/editor/commenter/reader), `projects` e `notes` no Postgres, com RLS baseada em `auth.uid()` — uma organizacao nao ve projetos nem notas de outra. Validado criando duas organizacoes distintas e confirmando que uma nao enxerga os dados da outra.
- Os 13 blocos do Project Model Canvas, agrupados pelas 5 perguntas do metodo e posicionados no layout classico do livro.
- Cartoes/notas: criar, editar, excluir, marcar como "validada" ou "em revisao", busca por texto e filtro por status — agora persistidos linha a linha no banco (nao mais um blob JSONB), com o autor sendo o nome/iniciais do usuario logado de verdade.
- Sincronizacao em tempo real por projeto (nao mais um unico canal fixo de demonstracao): uma nota criada em uma aba aparece na outra sem reload, validado com duas abas da mesma conta.
- Exportacao de um backup em JSON do canvas (blocos, comentarios, metadados).
- Criacao e troca de projetos dentro da organizacao ativa.

**Lacunas que continuam**

- Convite de membros por e-mail ainda nao existe — hoje so quem cria a organizacao vira membro (`admin`); adicionar `editor`/`commenter`/`reader` exige insercao manual na tabela `memberships`.
- Recuperacao de senha, MFA e revogacao de sessao ainda nao foram implementadas.
- Comentarios continuam uma lista unica por projeto salva so em `localStorage`, sem vinculo com nota/bloco, sem mencoes, sem resolucao e sem sincronizacao entre usuarios — decisao deliberada de manter fora de escopo nesta rodada.
- "Versao" e apenas um numero decimal incrementado por um botao; nao ha snapshot imutavel, historico nem comparacao entre versoes.
- "Aprovar" e um unico botao que muda o status do projeto; nao existe aprovacao por bloco, por stakeholder, nem evento de auditoria associado.
- O painel de "Atividade" agora mostra um aviso honesto de que a trilha de auditoria ainda nao foi implementada (antes mostrava eventos fixos ilustrativos atribuidos a pessoas ficticias).
- Exportacao gera apenas JSON; falta PDF e PNG previstos no MVP.
- Nao ha sessao facilitada, presenca de colaboradores, nem qualquer integracao externa.
- Ainda nao existe camada de API propria: o front-end fala direto com o Supabase, com autorizacao inteira delegada a RLS.

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

*Os papeis `admin`/`editor`/`commenter`/`reader` ja existem como coluna real em `memberships` e a RLS ja distingue leitura (qualquer membro) de escrita (so `admin`/`editor`). Na pratica, porem, hoje toda organizacao tem um unico membro — quem a criou, sempre `admin` — porque o convite de novos membros ainda nao tem UI. Ver secao 2.*

## 5. Escopo funcional do MVP

### 5.1 Organizacoes e acesso

- [PARCIAL] Cadastro da organizacao e convite de usuarios por e-mail — criar a organizacao funciona; convidar outros usuarios ainda nao tem UI (exige insercao manual em `memberships`).
- [PARCIAL] Login, recuperacao de acesso, MFA opcional e sessoes revogaveis — login por e-mail+senha e link magico funcionam; recuperacao de senha, MFA e revogacao de sessao ainda faltam.
- [FEITO] Multi-tenancy com isolamento rigoroso por `organization_id` — RLS baseada em `auth.uid()` e membership, validada criando duas organizacoes e confirmando isolamento total.
- [PARCIAL] Papeis: administrador, editor, comentarista e leitor — enum e RLS ja existem e distinguem leitura de escrita; hoje so o papel `admin` e atribuido na pratica (quem cria a organizacao), pois nao ha convite de membros com outros papeis.

### 5.2 Projetos e canvas

- [PARCIAL] Criacao de projeto a partir de canvas em branco ou template — cria em branco (sem notas de exemplo); nao ha templates de fato.
- [FEITO] Os 13 blocos do Project Model Canvas, agrupados pelas perguntas do metodo, no layout classico.
- [PARCIAL] Edicao de cartoes/notas com texto curto, autor e status (validada/em revisao) — autor agora e o nome/iniciais do usuario logado (nao mais fixo); ainda sem data, etiqueta livre ou responsavel dedicado.
- [PARCIAL] Busca e filtro por status — reordenacao, fixacao e arquivamento de notas ainda nao existem.
- [PENDENTE] Campos de apoio: objetivo SMART, indicador, fonte da evidencia e data de revisao.
- [PENDENTE] Destaque de blocos vazios, notas sem responsavel e dependencias nao validadas.

### 5.3 Colaboracao

- [PARCIAL] Edicao concorrente — sincronizacao via Supabase Realtime por linha (insert/update/delete), agora funcionando em qualquer projeto de qualquer organizacao, nao so num canvas de demonstracao; ainda e "ultima escrita vence", sem presenca nem resolucao de conflito.
- [PARCIAL] Comentarios — existe um painel, mas e uma lista unica por projeto, sem vinculo com nota/bloco, sem mencoes ou resolucao, salva apenas no `localStorage` do navegador (fora de escopo nesta rodada, ver secao 2).
- [PENDENTE] Sessao facilitada com pauta, cronometro, fases de ideacao, agrupamento e validacao.
- [PENDENTE] Convite por link com expiracao e permissao limitada.
- [PENDENTE] Registro de quem criou, alterou ou validou cada decisao — o painel "Atividade" hoje mostra um aviso de que a trilha de auditoria ainda nao existe (nao mostra mais eventos fixos ilustrativos).

### 5.4 Governanca e saidas

- [PARCIAL] Status do projeto — um botao alterna entre RASCUNHO, EM VALIDACAO e APROVADO, agora persistido em `projects.status`; faltam "em execucao" e "arquivado", e nao ha fluxo de aprovacao por pessoa.
- [PARCIAL] Versionamento — existe um numero de versao persistido em `projects.version` que incrementa a cada clique; nao ha snapshot imutavel nem comparacao entre versoes.
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

- **Frontend web:** React com TypeScript, editor de canvas responsivo e atualizacao em tempo real. *Em uso: React 19 + TypeScript + Vite. `App.tsx` deixou de possuir identidade propria e passou a receber sessao/organizacao/papel via props, com `AuthGate.tsx` decidindo entre login, onboarding de organizacao e o app.*
- **API:** backend modular REST ou GraphQL, com autorizacao centralizada e validacao de comandos. *Ainda nao existe: o front-end fala direto com o Supabase, com autorizacao inteira delegada a RLS.*
- **Tempo real:** WebSocket com protocolo de presenca e sincronizacao; usar CRDT ou controle otimista com revisao de conflitos. *Em uso: Supabase Realtime (`postgres_changes`) com um canal por projeto (insert/update/delete de notas, update de projeto), sem presenca e com "ultima escrita vence".*
- **Banco transacional:** PostgreSQL para organizacoes, usuarios, projetos, versoes, blocos, notas, comentarios e aprovacoes. *Em uso: Supabase Postgres com `organizations`, `memberships`, `projects` e `notes`, RLS por organizacao via `auth.uid()`. Ainda faltam `canvas_versions`, `comments`, `approvals`, `audit_events` e as demais entidades da secao 8.2.*
- **Arquivos:** armazenamento S3 compativel para exportacoes, anexos e imagens. *Nao iniciado.*
- **Fila:** Redis ou servico gerenciado para exportacao, notificacoes e tarefas demoradas. *Nao iniciado.*
- **Identidade:** provedor OIDC/SAML no plano corporativo; e-mail e MFA no plano inicial. *Parcial: Supabase Auth habilitado com e-mail+senha e link magico; MFA e SSO corporativo ainda nao iniciados.*
- **Observabilidade:** logs estruturados, metricas, tracing e auditoria com retencao configuravel. *Nao iniciado — hoje so ha `console.warn` para falhas de leitura e um banner de erro na tela para falhas de escrita (ex.: RLS negando uma acao).*

### 8.2 Modelo de dados minimo

- `organizations`, `users`, `memberships`, `roles`
- `projects`, `project_members`, `templates`
- `canvases`, `canvas_versions`, `canvas_blocks`, `notes`
- `comments`, `mentions`, `approvals`, `audit_events`
- `risks`, `deliverables`, `requirements`, `stakeholders`
- `subscriptions`, `usage_counters`, `exports`, `invitations`

Recomenda-se guardar o snapshot completo da versao publicada e os eventos de alteracao separadamente. Isso simplifica comparacao, auditoria e restauracao sem sacrificar a consulta do estado atual.

*Implementado hoje: `organizations`, `memberships` (papel, sem tabela `roles` separada), `projects` e `notes` (`supabase/schema.sql`). Os 13 blocos continuam fixos no front-end, nao no banco — nao ha `canvas_blocks`. Ainda faltam `canvases`/`canvas_versions` (versionamento real), `comments`/`mentions`, `approvals`, `audit_events`, `risks`/`deliverables`/`requirements`/`stakeholders` como entidades proprias, e `subscriptions`/`usage_counters`/`exports`/`invitations`.*

## 9. Seguranca e requisitos nao funcionais

- Autorizacao em toda consulta e mutacao, com testes de isolamento entre tenants.
- Criptografia em transito e em repouso; segredos fora do repositorio.
- MFA, politicas de senha, rate limiting e protecao contra abuso de links publicos.
- Backup automatico, restauracao testada e objetivo de disponibilidade definido por plano.
- LGPD: finalidade, minimizacao, exportacao e exclusao de dados pessoais, consentimento quando aplicavel e registro de operador/controlador.
- Acessibilidade WCAG 2.2 AA: teclado, foco visivel, contraste, leitor de tela e alternativa textual para o canvas visual.
- Responsividade para consulta e edicao leve em tablet; sessao completa de facilitação prioriza desktop.
- Metas iniciais: carregamento do canvas em menos de 2 s em P95, autosave confirmado em menos de 1 s e perda de dados igual a zero após confirmação.

*Autorizacao e isolamento entre tenants: feito e validado (RLS via `auth.uid()`, testado com duas organizacoes distintas). Os demais itens continuam nao verificados: sem MFA/rate limiting, sem teste formal de backup/restauracao, sem auditoria de acessibilidade, sem revisao formal de LGPD.*

## 10. Roadmap

### Fase 0 - Descoberta, 2 semanas

Validar com 3 a 5 organizacoes: tipos de projeto, processo de aprovacao, necessidade de templates, formato de exportacao e requisitos LGPD. Produzir prototipo navegavel e teste de uma sessao de canvas.

*Status: o prototipo navegavel do canvas existe (secao 2) e ja serve para essa validacao; as entrevistas com organizacoes-piloto ainda nao foram registradas neste plano.*

### Fase 1 - MVP, 8 a 12 semanas

Acesso multi-organizacao, projetos, 13 blocos, notas, comentarios, permissoes, autosave, versoes, aprovacao, exportacao PDF e painel basico.

*Status: em andamento, com a fundacao destravada. Feito — acesso multi-organizacao real (auth + RLS), os 13 blocos, projetos e notas com autosave via Supabase (nao mais localStorage), permissoes basicas (leitura para todo membro, escrita para admin/editor). Ainda faltando — comentarios sincronizados no banco, versoes reais (snapshot/comparacao), aprovacao por bloco, exportacao PDF e painel de projetos com status/riscos/aprovacoes pendentes.*

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

*Atendidos e validados: "dois usuarios veem alteracoes sem recarregar" (testado com duas abas da mesma conta via Realtime) e "usuario sem permissao nao consegue ler dados de outro projeto" (testado criando uma segunda organizacao e confirmando que ela nao ve os projetos da primeira). Os demais continuam pendentes: nao ha fluxo de aprovacao com comentario, PDF/PNG, auditoria real nem verificacao formal de acessibilidade.*

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

Com a fundacao de autenticacao e multi-tenancy validada, os proximos passos de maior impacto sao, em ordem sugerida:

1. ~~Habilitar Supabase Auth e introduzir `organizations`/`users`/`memberships`.~~ Feito e validado em 20/08/2026.
2. ~~Substituir a tabela unica `project_canvases` pelo modelo relacional minimo (`projects`, `notes`).~~ Feito — `canvases`/`canvas_versions` ficam para quando o versionamento real for implementado (item 5).
3. ~~Trocar as policies de demonstracao por policies baseadas em `auth.uid()` e membership de organizacao.~~ Feito e validado com isolamento real entre duas organizacoes.
4. Convite de membros por e-mail (hoje so o criador da organizacao vira membro) e vincular comentarios e notas por `nota_id`/`bloco_id` no banco em vez de listas soltas em `localStorage`, para permitir sincronizacao real de comentarios entre usuarios.
5. So depois disso investir em versionamento imutavel (`canvases`/`canvas_versions`), aprovacao por bloco, exportacao PDF/PNG e auditoria (`audit_events`) — funcionalidades que agora tem identidade e dados relacionais para se apoiar.

## 15. Decisoes para iniciar o projeto

1. Definir se a primeira versao sera exclusiva para projetos internos ou tambem para consultorias com varios clientes.
2. Escolher o nivel de edicao concorrente do MVP: controle otimista simples ou CRDT desde o inicio.
3. Confirmar a politica de dados, residencia e retencao para clientes brasileiros.
4. Selecionar 3 organizacoes-piloto e medir uma sessao completa de construcao e aprovacao.
5. Aprovar o prototipo antes do desenvolvimento, com foco na leitura do canvas inteiro em uma unica tela.
6. ~~Priorizar autenticacao e multi-tenancy antes de continuar investindo em recursos visuais do canvas.~~ Feito em 20/08/2026 — ver secao 2. Proxima prioridade de risco: convite de membros e comentarios sincronizados (secao 14, item 4), pois sem isso a colaboracao real entre pessoas de uma mesma organizacao ainda depende de compartilhar login.
