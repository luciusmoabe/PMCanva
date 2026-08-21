# Plano de solucao SaaS para Project Model Canvas

## 1. Visao

Criar uma plataforma SaaS multi-organizacao para que equipes montem, discutam, validem, versionem e apresentem seus Project Model Canvas. O produto deve preservar a simplicidade visual e a dinamica colaborativa do canvas em papel, acrescentando recursos digitais de rastreabilidade, governanca e integracao.

O canvas nao sera apenas um formulario. Cada projeto tera um modelo vivo, com blocos editaveis, evidencia das decisoes, responsaveis, historico e status de validacao.

## 2. Status atual do desenvolvimento

Situacao registrada em 20/08/2026. O app tem autenticacao real e multi-tenancy de verdade: cada organizacao isola seus proprios projetos e notas via RLS do Supabase, validado ponta a ponta (cadastro, criacao de organizacao, criacao de projeto, notas em tempo real e isolamento entre duas organizacoes diferentes). Na mesma data, entrou tambem convite de membros por e-mail (sem envio real de e-mail — ver abaixo) e comentarios sincronizados por projeto, substituindo o convite manual via banco e a lista de comentarios presa ao `localStorage`. Testado com quatro contas reais (admin, editor convidado, leitor convidado, estranho sem convite) confirmando papeis, isolamento de convites e sincronizacao em tempo real de notas e comentarios entre usuarios diferentes — nao so entre abas da mesma conta, como na rodada anterior.

Esse teste tambem revelou e corrigiu um bug real de uma rodada anterior: `listMyMemberships()` nao filtrava pela linha do proprio usuario, so pela regra de RLS "e membro dessa organizacao" — que corretamente deixa um membro ver as linhas de `memberships` de *todos* os colegas da mesma org (necessario para outras funcionalidades), mas fazia essa funcao especifica devolver a primeira linha que encontrasse para aquela organizacao, nao necessariamente a do usuario logado. Com uma organizacao de um membro so (o unico caso testado ate entao) isso nunca dava errado; com dois membros, o segundo usuario podia acabar vendo o papel do primeiro. Corrigido filtrando explicitamente por `user_id` no cliente.

Ainda no dia 20/08/2026, entraram duas pecas de governanca: **projeto aprovado agora trava de verdade** (trigger + RLS no banco impedem criar, editar ou excluir nota, e impedem editar qualquer campo do projeto, enquanto o status for `APROVADO`; "Nova versão" e o unico jeito de destravar) e **trilha de auditoria real** (tabela `audit_events`, escrita so por triggers — nunca pelo cliente — registrando quem criou/editou/excluiu cada nota e quem aprovou/reabriu o projeto, substituindo o aviso "ainda nao implementado" na aba Atividade). Ambos validados tentando contornar pela API direto (sem passar pela UI) e confirmando que o banco rejeita.

Ainda no dia 20/08/2026, entrou tambem o **snapshot imutavel de versao**: um trigger (`snapshot_canvas_version`) grava uma copia congelada de todas as notas toda vez que o projeto e aprovado, e uma nova aba "Versões" lista e permite expandir cada snapshot. Testado com dois ciclos de aprovacao seguidos, confirmando que aprovar a versao seguinte nao altera o que ja tinha sido congelado na anterior.

Ainda no dia 20/08/2026, entrou tambem a **aprovacao por bloco**: cada um dos 13 blocos pode ser travado individualmente (tabela `block_approvals`), independente da aprovacao do projeto inteiro, com a mesma trava real via RLS (`block_is_locked`) e o mesmo cuidado de liberar tudo quando "Nova versão" reabre o projeto.

Ainda no dia 20/08/2026, entrou o **link de leitura publica**: qualquer versao aprovada pode ser compartilhada por um link com token aleatorio, sem exigir login — a unica abertura no schema inteiro para o papel `anon` e uma funcao que devolve so os dados daquele token especifico, nenhuma tabela ganhou policy de RLS para anonimos.

O que falta agora e sobretudo aprovacao por multiplos stakeholders (hoje e binario, uma aprovacao so por bloco), tela de comparacao entre versoes, e envio real de e-mail para convites (depende de credenciais externas) — a fundacao de identidade, a colaboracao basica, o travamento de governanca, o historico de versoes e o compartilhamento publico ja estao de pe.

**Stack em uso**

- Front-end: React 19 + TypeScript + Vite, sem roteador. `AuthGate.tsx` decide entre tela de login (`AuthScreen.tsx`), onboarding de organizacao (`OrgOnboarding.tsx`) e o app (`App.tsx`), que recebe sessao/organizacao/papel via props.
- Icones: lucide-react.
- Autenticacao: Supabase Auth, com e-mail+senha e link magico (OTP por e-mail).
- Persistencia e tempo real: Supabase (Postgres + Realtime), acessado direto do navegador via `@supabase/supabase-js`, ainda sem camada de API propria.
- Sem backend dedicado, sem fila, sem storage de arquivos, sem observabilidade alem de `console.warn` e um banner de erro na tela para falhas de escrita.

**O que ja funciona**

- Cadastro e login por e-mail+senha e por link magico; sessao gerenciada pelo Supabase Auth.
- Recuperacao de senha: "Esqueci minha senha" na tela de login envia o link de redefinicao nativo do Supabase; ao voltar pelo link, o app mostra uma tela dedicada para definir a nova senha antes de liberar o workspace.
- MFA (dois fatores) via TOTP: painel em "Configurações" para ativar/desativar (QR code + segredo + confirmacao por codigo); no login, quem tem um fator ativo passa por uma tela de desafio antes de entrar no workspace. Enforcement e so no nivel de UI, nao de RLS (ver secao 14, item 10).
- Criacao de organizacao no primeiro acesso (`create_organization_with_owner`), que ja registra quem criou como `admin`.
- Multi-tenancy real: `organizations`, `memberships` (papeis admin/editor/commenter/reader), `projects`, `notes`, `comments` e `invitations` no Postgres, com RLS baseada em `auth.uid()` — uma organizacao nao ve projetos, notas nem convites de outra. Validado criando duas organizacoes distintas e confirmando que uma nao enxerga os dados da outra.
- Convite de membros por e-mail (tela "Equipe" na sidebar): admin cadastra e-mail+papel, a pessoa convidada ve o convite ao logar/cadastrar com aquele e-mail e pode aceitar — entra na organizacao com o papel definido. Admin tambem ve a lista de membros e pode revogar convites pendentes. **Envio real de e-mail pronto no codigo** (Edge Function `send-invitation-email` + Resend), mas nao ativado neste ambiente ainda — falta so a configuracao descrita em `SUPABASE-SETUP.md`. Sem essa configuracao, o convite continua funcionando normalmente e a UI avisa que o e-mail nao saiu, sem travar nada.
- Os 13 blocos do Project Model Canvas, agrupados pelas 5 perguntas do metodo e posicionados no layout classico do livro.
- Cartoes/notas: criar, editar, excluir, marcar como "validada" ou "em revisao", busca por texto e filtro por status — persistidos linha a linha no banco, com o autor sendo o nome/iniciais do usuario logado de verdade.
- Comentarios por projeto: persistidos no banco (tabela `comments`) e sincronizados em tempo real entre usuarios diferentes da mesma organizacao — ainda em nivel de projeto, nao por nota/bloco (decisao deliberada, ver "Lacunas" abaixo).
- Papeis com efeito real na UI e no banco: `reader` nao ve botao de adicionar nota nem de comentar (e a escrita seria rejeitada pela RLS mesmo se tentasse pela API direto); so `admin` ve o formulario de convite na tela Equipe.
- Sincronizacao em tempo real por projeto (notas, projeto e comentarios no mesmo canal): uma mudanca feita por um usuario aparece para outro usuario da mesma organizacao sem reload, validado entre contas diferentes (nao so entre abas da mesma conta).
- Exportacao do canvas em JSON (backup completo com blocos, comentarios, metadados), PNG e PDF (captura fiel da tela, via `html-to-image` + `jsPDF`, ambos carregados sob demanda).
- Criacao e troca de projetos dentro da organizacao ativa.
- Projeto `APROVADO` fica travado de verdade: um trigger no banco (`enforce_project_lock`) bloqueia qualquer update no projeto que mantenha o status aprovado, e a RLS de `notes` passa a rejeitar insert/update/delete enquanto o projeto do dono da nota estiver aprovado. "Nova versão" continua liberado (e o unico jeito de destravar). Comentarios continuam liberados mesmo com o projeto aprovado, de proposito.
- Trilha de auditoria real: tabela `audit_events`, escrita exclusivamente por triggers (`log_note_audit_event`, `log_project_audit_event`) — o cliente nao tem policy de insert, testado tentando inserir direto pela API e confirmando rejeicao. A aba "Atividade" mostra criacao/edicao/exclusao de nota e aprovacao/nova versao do projeto, com autor real e timestamp, mais recente primeiro.
- Snapshot imutavel de versao: tabela `canvas_versions`, escrita so pelo trigger `snapshot_canvas_version` toda vez que o projeto entra em `APROVADO`, guardando nome/gerente/numero de versao e uma copia das notas daquele momento (bloco, texto, autor, cor, status). A aba "Versões" lista as aprovacoes e permite expandir cada uma para ver o snapshot completo por bloco.
- Painel "Visão geral" com todos os projetos da organizacao (status, gerente, versao, ultima revisao) e contagem de aprovados/pendentes, com atalho para abrir qualquer um direto no canvas.
- Cor de cada nota escolhivel pelo usuario (6 opcoes), na criacao e na edicao, persistida e sincronizada em tempo real.
- Campos de apoio opcionais em qualquer nota: indicador, fonte da evidencia e data de revisao — recolhidos por padrao ao criar, sempre visiveis ao editar.
- Aprovacao por bloco: qualquer um dos 13 blocos pode ser aprovado/desaprovado individualmente, travando so as notas daquele bloco (o resto do canvas continua editavel), com trava real via RLS (validado tentando inserir nota direto pela API num bloco travado: 403). "Nova versão" libera as aprovacoes de bloco junto com a do projeto.
- Link de leitura publica para versoes aprovadas: token aleatorio por versao, pagina somente-leitura sem login (`?share=<token>`), sem abrir nenhuma policy de RLS para anonimos — so uma funcao estreita que devolve exatamente uma versao pelo token exato.
- Galeria de templates ("Templates" na sidebar): 3 modelos com notas reais em todos os 13 blocos (PMO, produto digital, evento corporativo); criar a partir de um template ja abre o canvas populado.
- Arquivar/restaurar projeto (soft delete): botao "Arquivar projeto" no modal de editar projeto some da lista principal sem apagar nada (notas, comentarios, aprovacoes, versoes e auditoria continuam intactos). A aba "Arquivados" (antes um item de menu morto) lista os arquivados com um botao "Restaurar". Funciona mesmo com o projeto aprovado/travado — o trigger de trava foi ajustado para isentar especificamente a mudanca de `archived_at`, mantendo bloqueado qualquer alteracao real de nome/gerente/versao enquanto travado. Nao ha exclusao definitiva — dado real nunca e apagado do banco por essa via.

**Lacunas que continuam**

- Convite so por e-mail cadastrado manualmente pelo admin, sem link de convite com expiracao (a secao 4.3 do plano original pede "convite por link"; o que existe e mais simples: um registro pendente por e-mail).
- Recuperacao de senha e MFA (dois fatores) ja existem (ver abaixo). Revogacao de sessao ainda nao foi implementada.
- Comentarios continuam em nivel de projeto (nao por nota/bloco), sem mencoes e sem resolucao — decisao deliberada de manter fora de escopo nesta rodada tambem, para nao desenhar uma UI de threads que ninguem pediu ainda.
- Ha snapshot imutavel e historico de versoes (aba "Versões"), mas nao ha tela de comparacao lado a lado entre duas versoes ainda — cada snapshot so pode ser visto isoladamente.
- Aprovacao por bloco existe (ver acima), mas e binaria — nao ha aprovacao por multiplos stakeholders (varias pessoas precisando aprovar o mesmo bloco).
- Exportacao ja cobre JSON, PNG e PDF (menu "Exportar"). A captura de imagem/PDF reflete a tela no estado atual (respeita busca/filtro), sem um modo dedicado de "exportar tudo".
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

*Os papeis `admin`/`editor`/`commenter`/`reader` existem como coluna real em `memberships`, a RLS distingue leitura (qualquer membro) de escrita de notas (`admin`/`editor`) e de comentarios (`admin`/`editor`/`commenter`), e agora e possivel colocar outra pessoa numa organizacao com qualquer um desses papeis via convite (secao 2). Testado com um `editor` e um `reader` convidados: o `reader` nao consegue escrever nota nem comentario pela UI (nem pela API direta, ja que a RLS rejeita).*

## 5. Escopo funcional do MVP

### 5.1 Organizacoes e acesso

- [PARCIAL] Cadastro da organizacao e convite de usuarios por e-mail — ambos funcionam; o convite nao envia e-mail de verdade (admin avisa por fora) e nao tem expiracao/link, so um registro pendente que a pessoa ve ao logar com aquele e-mail.
- [PARCIAL] Login, recuperacao de acesso, MFA opcional e sessoes revogaveis — login por e-mail+senha e link magico funcionam; recuperacao de senha, MFA e revogacao de sessao ainda faltam.
- [FEITO] Multi-tenancy com isolamento rigoroso por `organization_id` — RLS baseada em `auth.uid()` e membership, validada criando duas organizacoes e confirmando isolamento total.
- [FEITO] Papeis: administrador, editor, comentarista e leitor — enum e RLS distinguem leitura, escrita de notas e escrita de comentarios; validado convidando um `editor` e um `reader` reais e confirmando que o `reader` fica travado na escrita (UI esconde os botoes, e a RLS rejeitaria mesmo se tentasse pela API).

### 5.2 Projetos e canvas

- [FEITO em 20/08/2026] Criacao de projeto a partir de canvas em branco ou de um template. A aba "Templates" (item de menu que antes nao fazia nada) virou uma galeria com 3 modelos prontos — Implantacao de plataforma de PMO, Lancamento de produto digital e Evento corporativo, cada um com notas reais em todos os 13 blocos — e "Usar este template" cria o projeto ja populado. O primeiro template reaproveita um canvas real preenchido que ja existia no repositorio (`canvas-pmo-v1.8.json`, limpo de notas de teste); os outros dois foram escritos do zero. Nome e gerente sao definidos na criacao e **podem ser editados depois** (botao "..." na barra de ferramentas do canvas, visivel para admin/editor e escondido quando o projeto esta travado): o gerente e escolhido entre os membros reais da organizacao (`projects.manager_user_id`, coluna adicionada em 20/08/2026), nao mais um texto livre — `manager_name` continua existindo como rotulo de exibicao, preenchido automaticamente a partir do membro escolhido.
- [FEITO] Os 13 blocos do Project Model Canvas, agrupados pelas perguntas do metodo, no layout classico.
- [PARCIAL] Edicao de cartoes/notas com texto curto, autor e status (validada/em revisao) — autor agora e o nome/iniciais do usuario logado (nao mais fixo); ainda sem responsavel dedicado (so o autor de criacao). Ganhou indicador, fonte da evidencia e data de revisao como campos opcionais (ver abaixo).
- [PARCIAL] Busca e filtro por status — reordenacao, fixacao e arquivamento de notas ainda nao existem.
- [FEITO em 20/08/2026] Campos de apoio na nota: indicador, fonte da evidencia e data de revisao — 3 colunas opcionais em `notes` (`indicator`, `evidence_source`, `review_date`), disponiveis em qualquer nota (nao restrito ao bloco "Objetivos SMART"), atras de um "+ Campos de apoio" recolhido por padrao no composer, e sempre visiveis (editaveis ou so leitura conforme o papel) no modal de editar. "Objetivo SMART" do item original nao virou um 4º campo separado — a nota em si ja e o objetivo; esses 3 campos servem para deixar qualquer objetivo/beneficio/entrega mais mensuravel (S/M de SMART), nao para reescrever o texto da nota.
- [PENDENTE] Destaque de blocos vazios, notas sem responsavel e dependencias nao validadas.
- [FEITO em 20/08/2026] Usuario escolhe a cor de cada nota: seletor de 6 cores (a mesma paleta que ja existia no CSS) no composer de criar nota e no modal de editar. Puramente estetico por decisao deliberada — nao carrega significado (nao e "por tema" nem "por prioridade"); persistido em `notes.color` e sincronizado em tempo real igual ao resto da nota. Testado criando com uma cor, trocando ao editar e confirmando que sobrevive a um reload.

### 5.3 Colaboracao

- [PARCIAL] Edicao concorrente — sincronizacao via Supabase Realtime por linha (insert/update/delete), funcionando em qualquer projeto de qualquer organizacao entre usuarios diferentes; ainda e "ultima escrita vence", sem presenca nem resolucao de conflito.
- [PARCIAL] Comentarios — persistidos no banco e sincronizados em tempo real entre usuarios, gated por papel (`admin`/`editor`/`commenter` escrevem, `reader` so le); ainda em nivel de projeto, sem vinculo com nota/bloco, sem mencoes ou resolucao.
- [PENDENTE] Sessao facilitada com pauta, cronometro, fases de ideacao, agrupamento e validacao.
- [PARCIAL] Convite — existe convite por e-mail com papel definido pelo admin (secao 5.1); nao existe convite por *link* com expiracao e permissao limitada como descrito aqui.
- [FEITO] Registro de quem criou, alterou ou validou cada decisao — tabela `audit_events` escrita so por triggers de banco (cliente nao consegue inserir, testado), aba "Atividade" mostra autor real, acao e timestamp de cada evento em nota/projeto, mais recente primeiro.

### 5.4 Governanca e saidas

- [PARCIAL] Status do projeto — um botao alterna entre RASCUNHO, EM VALIDACAO e APROVADO, persistido em `projects.status`; faltam "em execucao" e "arquivado", e nao ha fluxo de aprovacao por pessoa (so um clique de quem tem papel editor/admin).
- [PARCIAL] Versionamento — o numero em `projects.version` incrementa a cada clique em "Nova versão", mas agora tem efeito real: **projeto `APROVADO` fica travado** (trigger + RLS no banco, nao so escondido na UI) — nenhuma nota pode ser criada, editada ou excluida, e nenhum campo do projeto muda, ate alguem clicar "Nova versão" (que volta o status a RASCUNHO). Validado tentando editar direto via API sem passar pela UI e confirmando rejeicao. Ainda nao ha snapshot imutavel do conteudo nem comparacao entre versoes — o travamento impede _mudar_ o conteudo aprovado, mas nao guarda uma copia dele em separado.
- [FEITO em 20/08/2026] Aprovacao por bloco: qualquer um dos 13 blocos pode ser aprovado/desaprovado individualmente (tabela `block_approvals`, RLS trava insert/update/delete de notas daquele bloco especifico via `block_is_locked`), independente da aprovacao do projeto inteiro — o antigo botao "..." morto no cabecalho de cada bloco virou esse controle. "Nova versão" tambem libera todas as aprovacoes de bloco automaticamente (nao so a do projeto), e cada aprovar/desaprovar vira evento na aba Atividade. Validado tanto pela UI quanto tentando inserir nota direto pela API num bloco travado (403, RLS rejeitou) e num bloco livre (201, sucesso). Aprovacao por multiplos stakeholders (mais de uma pessoa precisar aprovar o mesmo bloco) continua fora de escopo — hoje e so um estado binário aprovado/nao aprovado.
- [PARCIAL] Exportacao — gera um JSON de backup; faltam PDF, PNG e documento estruturado.
- [FEITO em 20/08/2026] Link de leitura publica para versoes aprovadas: cada snapshot em `canvas_versions` ganha um token aleatorio (`share_token`, uuid), e a unica porta aberta para `anon` no schema inteiro e uma funcao (`get_public_canvas_version`) que devolve os dados de exatamente uma versao pelo token exato — nenhuma policy de RLS foi aberta para anonimos, `projects`/`notes`/`canvas_versions` continuam 100% autenticados. Botao "Copiar link" na aba Versões. Como o app nao tem roteador, o link funciona via `?share=<token>` na URL, detectado em `main.tsx` antes mesmo do `AuthGate` — quem abre ve uma pagina isolada, sem sidebar nem qualquer acao de edicao. Validado abrindo o link numa aba sem sessao nenhuma (dados corretos, zero vazamento de UI autenticada) e com um token invalido (mensagem de "nao encontrado", sem erro).
- [FEITO em 20/08/2026] Painel "Visão geral": item de menu que antes nao fazia nada virou um dashboard com contagem de projetos/aprovados/aguardando aprovacao e uma tabela (nome, gerente, status, versao, ultima revisao) ordenada pela mais recente, com atalho "Abrir" para o canvas. "Riscos altos" ficou de fora de proposito — o bloco "Riscos" hoje e so texto livre, sem campo de severidade no modelo de dados, entao mostrar isso exigiria inventar um dado que nao existe.

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
- **Banco transacional:** PostgreSQL para organizacoes, usuarios, projetos, versoes, blocos, notas, comentarios e aprovacoes. *Em uso: Supabase Postgres com `organizations`, `memberships`, `projects`, `notes`, `comments`, `invitations` e `audit_events`, RLS por organizacao via `auth.uid()`, mais um trigger de trava (`enforce_project_lock`) em `projects`. Ainda faltam `canvas_versions`, `approvals`, `mentions` e as demais entidades da secao 8.2.*
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

Recomenda-se guardar o snapshot completo da versao publicada e os eventos de alteracao separadamente. Isso simplifica comparacao, auditoria e restauracao sem sacrificar a consulta do estado atual. *Feito em 20/08/2026: `canvas_versions` guarda o snapshot (jsonb de notas por versao) e `audit_events` guarda os eventos, ambos separados do estado atual em `projects`/`notes` — ver secao 2 e secao 14, item 7.*

*Implementado hoje: `organizations`, `memberships` (papel, sem tabela `roles` separada), `projects`, `notes`, `comments` (nivel de projeto, sem `note_id`/`block_id`), `invitations` e `audit_events` (`supabase/schema.sql`). Os 13 blocos continuam fixos no front-end, nao no banco — nao ha `canvas_blocks`. Ainda faltam `canvases`/`canvas_versions` (snapshot imutavel de versao), `mentions`, `approvals`, `risks`/`deliverables`/`requirements`/`stakeholders` como entidades proprias, e `subscriptions`/`usage_counters`/`exports`.*

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

*Status: em andamento, com a fundacao, a colaboracao basica e o travamento de governanca destravados. Feito — acesso multi-organizacao real (auth + RLS), convite de membros por e-mail, os 13 blocos, projetos e notas com autosave via Supabase, comentarios sincronizados no banco, permissoes por papel, projeto aprovado travado de verdade (banco, nao so UI) e trilha de auditoria real. Ainda faltando — snapshot imutavel de versao (guardar copia separada do conteudo aprovado), aprovacao por bloco, exportacao PDF e painel de projetos com status/riscos/aprovacoes pendentes.*

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

*Atendidos e validados: "dois usuarios veem alteracoes sem recarregar" (testado entre contas diferentes via Realtime), "usuario sem permissao nao consegue ler dados de outro projeto" (testado com uma segunda organizacao) e "auditoria identifica autor, acao, horario e objeto alterado" (tabela `audit_events`, testado tentando escrever direto pela API e confirmando rejeicao). Os demais continuam pendentes: nao ha fluxo de aprovacao com comentario nem versao publicada preservada separadamente (o travamento impede editar o aprovado, mas nao guarda uma copia dele), sem PDF/PNG, sem verificacao formal de acessibilidade.*

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

Com a fundacao de autenticacao/multi-tenancy e a colaboracao basica entre membros validadas, os proximos passos de maior impacto sao, em ordem sugerida:

1. ~~Habilitar Supabase Auth e introduzir `organizations`/`users`/`memberships`.~~ Feito e validado em 20/08/2026.
2. ~~Substituir a tabela unica `project_canvases` pelo modelo relacional minimo (`projects`, `notes`).~~ Feito — `canvases`/`canvas_versions` ficam para quando o versionamento real for implementado (item 4).
3. ~~Trocar as policies de demonstracao por policies baseadas em `auth.uid()` e membership de organizacao.~~ Feito e validado com isolamento real entre duas organizacoes.
4. ~~Convite de membros por e-mail e comentarios sincronizados no banco entre usuarios.~~ Feito e validado em 20/08/2026 (sem envio real de e-mail; comentarios ainda em nivel de projeto, nao por nota/bloco).
5. ~~Travar edicao de notas/projeto quando o status for `APROVADO`.~~ Feito e validado em 20/08/2026: um trigger no banco (`enforce_project_lock`) mais RLS em `notes` bloqueiam qualquer escrita enquanto aprovado, ate "Nova versão" resetar o status — testado inclusive tentando editar via API direto, sem passar pela UI. Comentarios continuam liberados de proposito.
6. ~~Trilha de auditoria (`audit_events`).~~ Feito e validado em 20/08/2026: triggers em `notes` e `projects` registram criacao/edicao/exclusao de nota e aprovacao/nova versao do projeto, com autor real; sem policy de insert para o cliente (testado tentando inserir direto pela API). A aba "Atividade" mostra esse historico de verdade.
7. ~~Investir em snapshot de versao real (`canvas_versions`, com tela de historico).~~ Feito e validado em 20/08/2026: um trigger (`snapshot_canvas_version`) grava uma copia imutavel de todas as notas (bloco, texto, autor, cor, status) toda vez que o projeto entra em `APROVADO`, junto com nome/gerente/numero de versao daquele momento. A aba "Versões" lista cada aprovacao e permite expandir para ver o snapshot completo por bloco. Testado com dois ciclos de aprovacao seguidos: a versao 1.0 continuou mostrando so a nota original mesmo depois que a versao 1.1 foi aprovada com uma nota nova. Ainda falta tela de comparacao lado a lado entre versoes — hoje cada snapshot so pode ser visto isoladamente.
8. ~~Exportacao em PDF/PNG.~~ Feito e validado em 20/08/2026: o canvas e capturado via `html-to-image` (`toPng`) e, para PDF, a imagem resultante e embutida num `jsPDF` do tamanho exato da captura — as duas bibliotecas sao carregadas por `import()` dinamico, entao nao engordam o bundle principal para quem nunca exporta. O botao "Exportar" virou um menu com as tres opcoes (Imagem PNG, PDF, Backup JSON). A captura reflete o que esta na tela no momento (respeita busca/filtro ativos), igual a um "print" — nao existe um modo "exportar tudo ignorando filtro".
9. ~~Recuperacao de senha.~~ Feito em 20/08/2026: fluxo nativo do Supabase Auth — "Esqueci minha senha" na tela de login chama `resetPasswordForEmail`, e o link do e-mail volta com `type=recovery` na URL, que o client detecta sozinho e dispara o evento `PASSWORD_RECOVERY`; `AuthGate` intercepta esse evento e mostra uma tela dedicada de nova senha antes de liberar o app. Validado o lado do pedido (link "Esqueci minha senha" aparece so na aba Entrar, troca de tela, envio sem erro, botao "Voltar"); o lado da confirmacao (clicar no link do e-mail de verdade e definir a nova senha) nao foi validado ponta a ponta porque o Supabase nao expoe o conteudo do e-mail enviado para automatizar esse clique — mesma limitacao ja registrada para o convite de membros.
10. ~~MFA (dois fatores).~~ Feito e validado em 20/08/2026: TOTP nativo do Supabase Auth (`auth.mfa`). Tela "Configurações" (antes um botao morto na sidebar) ganhou um painel de seguranca para ativar/desativar — mostra QR code + segredo, confirma com um codigo de 6 digitos. No login, se a conta tem um fator verificado, o app intercepta antes de liberar o workspace e exige o codigo (`getAuthenticatorAssuranceLevel` + tela dedicada de desafio, com opcao de sair caso o usuario tenha perdido o autenticador). Testado ponta a ponta gerando os codigos TOTP de verdade a partir do segredo (RFC 6238) num script, sem depender de app autenticador externo: ativar, sair, entrar de novo (cai na tela de desafio), verificar com codigo novo, e desativar — os quatro passos confirmados, sem erro de console. Enforcement e so no client (checagem de AAL na UI); nao ha policy de RLS que exija `aal2`, entao uma chamada direta a API com sessao aal1 ainda passaria pela RLS normal — fora de escopo por ora, mesma logica de "RLS e a unica fronteira real" que o resto do projeto ja segue para outras regras.
11. ~~Aprovacao por bloco.~~ Feito e validado em 20/08/2026: tabela `block_approvals`, cada um dos 13 blocos trava/destrava independente do resto do canvas e da aprovacao do projeto inteiro, com RLS real (`block_is_locked`) — testado pela UI e tentando inserir nota direto pela API num bloco travado (403). "Nova versão" libera as aprovacoes de bloco tambem. Aprovacao por multiplos stakeholders continua fora de escopo (hoje e binario).
12. ~~Link de leitura publica para versoes aprovadas.~~ Feito e validado em 20/08/2026: token aleatorio por versao (`canvas_versions.share_token`), exposto por uma unica funcao (`get_public_canvas_version`) liberada para o papel `anon` — nenhuma tabela ganhou policy de RLS para anonimos. Pagina publica isolada via `?share=<token>`, sem sidebar nem acao de edicao. Validado abrindo o link numa aba sem sessao (dados corretos) e com token invalido (erro tratado, sem vazamento).
13. ~~Real envio de e-mail para convites.~~ Codigo pronto em 20/08/2026, mas nao ativado — falta so voce configurar (ver `SUPABASE-SETUP.md`, secao "Envio de e-mail para convites"). Uma Edge Function (`send-invitation-email`) usa Resend; ela reconsulta o convite com o proprio JWT de quem chamou, entao quem pode ver a linha (RLS decide) e quem pode disparar o envio — nao duplica checagem de admin na function. Convidar continua funcionando mesmo sem a function implantada: se o envio falhar, o convite e criado normalmente e a UI mostra um aviso suave ("avise por fora"), sem travar o fluxo. Testado o caminho de falha graciosa (function nao implantada ainda): convite criado, aviso claro, zero erro que trava a tela. O caminho de sucesso (e-mail chegando de verdade) so pode ser validado depois que voce configurar a API key do Resend.

## 15. Decisoes para iniciar o projeto

1. Definir se a primeira versao sera exclusiva para projetos internos ou tambem para consultorias com varios clientes.
2. Escolher o nivel de edicao concorrente do MVP: controle otimista simples ou CRDT desde o inicio.
3. Confirmar a politica de dados, residencia e retencao para clientes brasileiros.
4. Selecionar 3 organizacoes-piloto e medir uma sessao completa de construcao e aprovacao.
5. Aprovar o prototipo antes do desenvolvimento, com foco na leitura do canvas inteiro em uma unica tela.
6. ~~Priorizar autenticacao e multi-tenancy antes de continuar investindo em recursos visuais do canvas.~~ Feito em 20/08/2026 — ver secao 2.
7. ~~Priorizar convite de membros e comentarios sincronizados antes de recursos visuais adicionais.~~ Feito em 20/08/2026 — ver secao 2.
8. ~~Travar edicao quando o projeto estiver aprovado e adicionar trilha de auditoria, antes de investir em snapshot de versao completo.~~ Feito em 20/08/2026 — ver secao 2 e secao 14, itens 5 e 6. ~~Proxima prioridade de risco: nao existe copia imutavel do conteudo aprovado.~~ Feito em 20/08/2026 — ver secao 14, item 7 (`canvas_versions`).
