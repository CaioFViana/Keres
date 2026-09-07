# Avaliação da arquitetura, manutenção e legibilidade

Data: 6 de setembro de 2026.

Revisão atual: commit `b26c5ca7`, comparado com seu pai `cc13b6e9`.

## Escopo e resultado

Avaliação qualitativa da estrutura do monorepo e de uma amostra dos fluxos de sincronização, persistência, interface e testes. Não representa uma auditoria exaustiva de todos os arquivos nem uma auditoria de segurança.

**Avaliação geral atual: aproximadamente 8/10 em manutenção e legibilidade, ante 7,5/10 na avaliação inicial.** A nota é um julgamento qualitativo, não uma métrica automática. O projeto tem boa separação entre aplicações e proteções contra regressões, mas algumas áreas exigem conhecer estado global, convenções implícitas e detalhes de infraestrutura para fazer mudanças com segurança.

Não há indicação, nesta análise, de necessidade de reescrever a arquitetura. As melhorias podem ser incrementais.

## Evolução após o último commit

| Ponto | Situação atual |
| --- | --- |
| D01 — Responsabilidades da tela | Corrigido; apresentação, estado, associações e ações possuem fronteiras próprias |
| D02 — Mensagem prematura de sucesso | Corrigido; recuperação de falha parcial tratada separadamente em D09 |
| D03 — Dependências globais | Corrigido; composição externa e ciclo de vida explícito adicionados |
| D04 — Compatibilidade dos bancos | Superfície comum delimitada e validada nos dois motores; ponte interna permanece |
| D05 — `any` nos contratos | Corrigido; `any` explícito proibido e fronteira dinâmica isolada e testada |
| D06 — Transações | Callback recebe a transação ativa; aninhamento e savepoints validados nos dois motores |
| D07 — Cobertura | Novos testes locais; pisos globais inalterados e cobertura atual não medida |
| D08 — Comentários | Limpeza parcial; redundância e mistura de idiomas permanecem |
| D09 — Repetição de salvamento após falha | Corrigido; a identidade persistida é retida antes das etapas secundárias |

## Arquitetura geral

| Área | Responsabilidade |
| --- | --- |
| `apps/client` | Aplicação React Native/Expo, banco SQLite local e sincronização |
| `apps/api` | Backend Bun/Elysia, serviços de negócio, persistência e colaboração; suporte a PostgreSQL e SQLite |
| `apps/desktop` | Distribuição Electron que reutiliza o cliente web |
| `apps/admin` | Administração e interface de showcase |
| `apps/site` | Site público |
| `packages/shared` | Entidades, contratos de validação, regras, metadados e cálculos compartilhados |

A API segue principalmente rotas → serviços → banco. O cliente combina telas, hooks, stores e serviços. A arquitetura é predominantemente em camadas, com módulos por domínio em algumas áreas. As regras de negócio não estão totalmente isoladas da infraestrutura ou do estado da interface.

## Boas práticas encontradas

### B01 — Responsabilidades claras entre aplicações e reutilização entre plataformas

O monorepo separa cliente, API, desktop, administração e site. O desktop reutiliza o cliente web, enquanto o pacote compartilhado concentra contratos e regras. Isso reduz duplicação e divergência entre plataformas.

Referências: [README.pt.md](README.pt.md), [package.json](package.json), [packages/shared/index.ts](packages/shared/index.ts).

### B02 — Sincronização dividida em responsabilidades menores

A API separa envio, recebimento e registro de operações em serviços próprios. O cliente separa agendamento, envio, recebimento e mídia. O uso de composição evita concentrar toda a implementação do protocolo em uma única classe.

Referências: [SyncService.ts](apps/api/src/services/SyncService.ts), [SyncEngineService.ts](apps/client/src/services/SyncEngineService.ts), [serviços de sincronização da API](apps/api/src/services/sync), [serviços de sincronização do cliente](apps/client/src/services/sync).

### B03 — Regras de arquitetura verificadas por testes

Há verificações para consultas de banco nas rotas, dependências indevidas entre camadas, certos ciclos de importação e tamanho de arquivos. Essas verificações ajudam a impedir que convenções se percam durante a evolução do projeto.

Os limites de tamanho são indicadores auxiliares: não comprovam, sozinhos, coesão ou simplicidade. As verificações de importação analisadas usam leitura textual e expressões regulares, portanto não equivalem a uma análise semântica completa de dependências.

Referências: [camadas da API](apps/api/test/architecture/layering.test.ts), [camadas do cliente](apps/client/test/architecture/layering.test.ts), [fronteiras de importação do cliente](apps/client/test/architecture/importBoundaries.test.ts).

### B04 — Testes voltados a riscos reais

Existem testes de concorrência, rollback, repetição de operações, exportação/importação e paridade de migrations. Eles verificam comportamentos importantes para integridade dos dados, além dos caminhos felizes.

Referências: [sincronização concorrente](apps/api/test/modules/sync.concurrency.integration.test.ts), [paridade de migrations](apps/api/test/db/migrationParity.integration.test.ts), [round trip de histórias](apps/api/test/services/storyExportRoundTrip.integration.test.ts).

### B05 — Disciplina de ferramentas e integração contínua

O projeto usa TypeScript estrito, ESLint, Biome para formatação, lockfile e instalação congelada no CI. O pipeline executa verificações de tipos, lint, cobertura e integração com PostgreSQL e SQLite. Também existem pisos específicos para áreas críticas de sincronização.

O Biome está configurado para formatação; seu linter desativado não significa ausência de lint, pois essa função é exercida pelo ESLint.

Referências: [CI](.github/workflows/ci.yml), [configuração TypeScript da API](apps/api/tsconfig.json), [configuração TypeScript do cliente](apps/client/tsconfig.json), [Biome](biome.json), [pisos de cobertura](scripts/coverage-thresholds.json).

### B06 — Abstrações pequenas para infraestrutura substituível

A interface `BlobStorage` separa operações de armazenamento físico das responsabilidades superiores de metadados e autorização. Isso permite implementações de disco e S3 sem espalhar detalhes dos provedores entre consumidores.

Referência: [BlobStorage.ts](apps/api/src/services/media-storage/BlobStorage.ts).

### B07 — Nomes e documentação geralmente ajudam a entender a intenção

Os nomes de serviços e módulos são, em geral, descritivos. Vários comentários explicam o motivo de decisões difíceis, especialmente na compatibilidade entre bancos e na sincronização. O README também fornece uma visão útil dos componentes e dos fluxos de desenvolvimento.

Referências: [README.pt.md](README.pt.md), [banco da API](apps/api/src/db/index.ts), [SyncService.ts](apps/api/src/services/SyncService.ts).

## Problemas e dívidas encontrados

### D01 — Tela de cena concentra responsabilidades demais

**Status: corrigido.**

A tela passou de 653 para 361 linhas físicas e agora se limita à composição dos hooks e à apresentação dos campos. O cálculo do índice fica em `SceneService`, enquanto `SceneSaveCoordinator` coordena a gravação base e as persistências secundárias.

Estado, hidratação e valores padrão ficam em `useSceneFormState`; criação do serviço e inicialização dos stores ficam em `useSceneFormResources`; relações, presença de personagens e efeitos ficam em `useSceneFormAssociations`. `useSceneFormActions` concentra validação, salvamento, exclusão, atributos, eventos, feedback e navegação.

Testes próprios do hook de ações verificam rejeição de entrada inválida, persistência completa e exclusão. O teste arquitetural impede que coordenação de persistência, alertas, eventos ou os hooks de associações retornem diretamente à tela.

Referências: [SceneFormScreen.tsx](apps/client/src/screens/narrative-elements/scenes/SceneFormScreen.tsx), [SceneService.ts](apps/client/src/services/storymanagement/SceneService.ts), [SceneSaveCoordinator.ts](apps/client/src/services/storymanagement/SceneSaveCoordinator.ts), [useSceneFormState.ts](apps/client/src/screens/narrative-elements/scenes/useSceneFormState.ts), [useSceneFormResources.ts](apps/client/src/screens/narrative-elements/scenes/useSceneFormResources.ts), [useSceneFormAssociations.ts](apps/client/src/screens/narrative-elements/scenes/useSceneFormAssociations.ts), [useSceneFormActions.ts](apps/client/src/screens/narrative-elements/scenes/useSceneFormActions.ts), [testes das ações](apps/client/test/screens/narrative-elements/scenes/useSceneFormActions.test.ts).

### D02 — Mensagem de sucesso antecede a conclusão da gravação

**Status: corrigido quanto ao momento da mensagem.**

A tela agora aguarda `saveSceneWithRelations` concluir a persistência de relações e atributos antes de comunicar sucesso. O apontamento anterior de mensagem prematura não descreve mais o código atual.

Isso não garante atomicidade ou recuperação segura de gravações parciais: o risco de repetir uma criação após falha está registrado separadamente em D09.

Referências: [SceneFormScreen.tsx](apps/client/src/screens/narrative-elements/scenes/SceneFormScreen.tsx), [SceneSaveCoordinator.ts](apps/client/src/services/storymanagement/SceneSaveCoordinator.ts), [testes do coordenador](apps/client/test/services/SceneSaveCoordinator.test.ts).

### D03 — Dependências globais e estado mutável dificultam isolamento

**Status: corrigido.**

`SyncEngineService` não possui mais construtor privado, `getInstance` ou criação interna de dependências concretas. Seu construtor público recebe `SyncEngineDependencies`, que inclui notificações, publicação de eventos, autenticação, cliente HTTP, handlers, serviços de conflito/servidor e operações de transferência. Testes podem criar instâncias independentes e substituir essas dependências sem acessar estado global da classe.

A escolha das implementações concretas e da instância única usada pelo aplicativo foi movida para `appSyncEngine`, a raiz de composição. O contexto agora possui operações explícitas de `bindDatabase`, `activateStory`, `stopSync`, `deactivateStory` e `reset`, além do estado observável `unbound`, `idle`, `active` ou `running`. Parar o agendamento não apaga mais silenciosamente a história ativa; encerrar o contexto é uma operação separada.

Um teste de arquitetura impede que singleton, emissor global, gerenciador de autenticação ou adaptador concreto de notificações retornem ao serviço. Os chamadores e testes foram migrados para a nova composição e para o ciclo de vida explícito.

Referências: [SyncEngineService.ts](apps/client/src/services/SyncEngineService.ts), [appSyncEngine.ts](apps/client/src/services/sync/appSyncEngine.ts), [SyncInitializer.tsx](apps/client/src/components/features/app/SyncInitializer.tsx), [teste de arquitetura](apps/client/test/architecture/importBoundaries.test.ts).

### D04 — Compatibilidade entre bancos depende de coerções de tipos

**Status: corrigido quanto à superfície pública.**

`CompatibleDb` deixou de ser um alias do banco PostgreSQL completo. Agora é uma interface limitada às operações efetivamente compartilhadas pela aplicação: consultas relacionais, `select`, `selectDistinct`, `insert`, `update`, `delete`, `execute` e transações. Recursos específicos dos drivers, como `$with`, `$count`, `all` e `run`, não aparecem no contrato consumido pelos serviços.

Os construtores retornam os tipos nativos de PostgreSQL e libSQL. Uma única ponte interna converte a conexão escolhida para a superfície compatível; o acesso nativo necessário às migrations é discriminado por dialeto e protegido por teste arquitetural. A aplicação não importa diretamente os drivers.

Os testes de contrato agora cobrem valores opcionais, chaves estrangeiras, datas, booleanos, JSON e as operações comuns de atualização, seleção e exclusão. Eles passaram integralmente em PostgreSQL e SQLite. A ponte dos builders em `schema/columns.ts` continua necessária porque o Drizzle não oferece um schema genérico comum aos dois dialetos; ela permanece confinada à infraestrutura e apoiada pelos testes de paridade.

Referências: [banco da API](apps/api/src/db/index.ts), [migrations](apps/api/src/db/migrate.ts), [construtores de colunas](apps/api/src/db/schema/columns.ts), [testes de contrato](apps/api/test/db/databaseContract.integration.test.ts), [teste arquitetural](apps/api/test/architecture/layering.test.ts).

### D05 — Uso de `any` em contratos centrais de sincronização

**Status: corrigido.**

Os contratos agora usam `SyncEntity`, `SyncStoredEntity`, tipos derivados dos schemas Zod e `unknown` nas fronteiras dinâmicas. O ESLint proíbe `any` explícito em `apps/api/src`, e um teste de arquitetura verifica a árvore sintática dos arquivos.

O registro de tabelas escolhido em runtime mantém uma coerção localizada, necessária para apagar diferenças entre dezenas de tipos concretos do Drizzle. Essa fronteira não usa `any`, não vaza para os contratos do protocolo e tem testes que verificam cobertura de todas as entidades sincronizadas, auditáveis e exportáveis. Ela é uma decisão de infraestrutura documentada, não uma permissão para coerções nos consumidores.

Referências: [BaseSyncEntityHandler.ts](apps/api/src/services/entity-sync-handlers/BaseSyncEntityHandler.ts), [registro de tabelas](apps/api/src/services/entity-solvers/ApiEntityTableRegistry.ts), [ESLint da API](apps/api/eslint.config.mjs), [testes de arquitetura](apps/api/test/architecture/layering.test.ts).

### D06 — Contexto transacional implícito exige conhecimento de convenções

**Status: contrato explícito e garantias preservadas.**

`withTransaction` agora entrega a transação ativa ao callback. Chamadas aninhadas recebem a mesma sessão, enquanto uma chamada explícita a `db.transaction` dentro do contexto continua representando um savepoint. O coordenador de push já usa o parâmetro explícito para suas consultas locais.

`Proxy` e `AsyncLocalStorage` permanecem como camada de compatibilidade para handlers existentes que importam `db`, mas já não são a única forma de consumir o contexto. Testes executados em PostgreSQL e SQLite verificam a identidade da transação aninhada, o rollback externo e o rollback isolado do savepoint.

Novos consumidores transacionais devem preferir o parâmetro entregue pelo callback. A migração dos handlers pode continuar incrementalmente quando houver benefício local, sem exigir uma alteração ampla e arriscada apenas para remover a camada de compatibilidade.

Referências: [banco da API](apps/api/src/db/index.ts), [teste de contexto transacional](apps/api/test/db/transactionContext.integration.test.ts).

### D07 — Exigência de cobertura desigual entre núcleo e cliente completo

**Status: melhora localizada; avaliação global inalterada. Prioridade: média.**

Os pisos do cliente completo continuam em 40,2% de linhas e 30% de branches; os do núcleo de sincronização continuam em 91,9% e 81,5%. São limites configurados, não cobertura medida nesta avaliação.

O commit adicionou testes de coordenação do salvamento, indexação, contrato de banco e transações. Isso melhora a proteção de comportamentos específicos. Os testes do coordenador verificam conclusão e propagação de falha, mas não rollback nem uma nova tentativa após falha parcial.

**Próximo passo:** testar a recuperação descrita em D09 e ampliar testes de fluxos relevantes antes de perseguir uma porcentagem arbitrária.

Referências: [pisos de cobertura](scripts/coverage-thresholds.json), [testes do coordenador](apps/client/test/services/SceneSaveCoordinator.test.ts), [testes de indexação](apps/client/test/services/SceneIndexing.test.ts).

### D08 — Comentários redundantes e idioma inconsistente

**Status: limpeza parcial. Prioridade: baixa.**

Foram removidos alguns comentários redundantes, mas ainda há exemplos como `// Import Zod` no handler base e mistura de português e inglês. Os exemplos antigos associados aos imports dos stores não devem ser tratados como evidência atual após a extração dos hooks.

**Próximo passo:** remover comentários que apenas narram a instrução e adotar uma convenção de idioma para novos comentários, preservando explicações de decisões e invariantes.

Referências: [BaseSyncEntityHandler.ts](apps/api/src/services/entity-sync-handlers/BaseSyncEntityHandler.ts), [construtores de colunas](apps/api/src/db/schema/columns.ts).

### D09 — Repetir salvamento após falha pode criar outra cena

**Status: corrigido.**

`SceneSaveCoordinator` agora comunica o ID persistido imediatamente após criar ou atualizar a cena, antes de iniciar relações e atributos. A tela retém esse ID mesmo quando uma etapa secundária falha.

Uma nova tentativa usa o ID retido e atualiza a cena existente. Testes simulam falhas tanto nas relações quanto nos atributos e verificam que `createScene` é chamado uma única vez, enquanto a retomada conclui por `updateScene`.

Referências: [SceneSaveCoordinator.ts](apps/client/src/services/storymanagement/SceneSaveCoordinator.ts), [SceneFormScreen.tsx](apps/client/src/screens/narrative-elements/scenes/SceneFormScreen.tsx), [testes do coordenador](apps/client/test/services/SceneSaveCoordinator.test.ts).

## Ordem sugerida de melhorias

1. Ampliar testes de comportamento dos fluxos alterados e medir a cobertura antes de reavaliar o panorama global — D07.
2. Limpar comentários redundantes e consolidar a convenção de idioma — D08.

D01, D02, D03, D04, D05 e D06 não devem continuar listados como correções pendentes.

## Validação realizada e limitações

- A revisão compara `b26c5ca7` com `cc13b6e9` e examina os arquivos atuais relacionados aos achados; não é uma auditoria exaustiva dos 84 arquivos alterados.
- Na avaliação inicial, passaram 3 arquivos e 9 testes de arquitetura da API.
- Após o commit, passaram **3 arquivos e 12 testes de arquitetura da API**.
- Após a correção de D09, passaram os **4 testes de `SceneSaveCoordinator`**, incluindo repetição após falhas em relações e atributos sem criação duplicada.
- Após a correção de D03, passaram o lint, o typecheck e a suíte completa do cliente: **254 arquivos e 2.388 testes**.
- Após a correção de D01, passaram o lint, o typecheck, os **19 testes focados** e a suíte completa do cliente: **255 arquivos e 2.391 testes**.
- O teste de arquitetura do cliente protege a composição externa do `SyncEngineService` e a ausência de singleton e dependências globais dentro da classe.
- Após D04 e D06, passaram typecheck, lint e **35 arquivos com 212 testes unitários da API**.
- A integração completa passou em SQLite com **55 arquivos e 610 testes**, e em PostgreSQL com **54 arquivos e 608 testes**, além de 1 arquivo e 2 testes condicionais ignorados nesse motor.
- Os contratos específicos de banco e transação passaram nos dois motores.
- A cobertura não foi medida nesta revisão.
- D09 agora possui testes de repetição após falhas nas relações e nos atributos.
- A nota é qualitativa e não certifica ausência de bugs nem desempenho, segurança ou correção de todos os fluxos.
- As mudanças posteriores à revisão estão registradas nos status de D01, D03, D04, D05, D06 e D09 e foram validadas pelas verificações descritas acima.
- Números de linhas e observações refletem o commit inspecionado e podem mudar com a evolução do repositório.
