# Avaliação da arquitetura, manutenção e legibilidade

Análise inicial: 6 de setembro de 2026.

Documento atualizado em 7 de setembro de 2026.

Revisão atual: commit `530cf574`, comparado com seu pai `b26c5ca7`.

## Escopo e resultado

Avaliação qualitativa da estrutura do monorepo e de uma amostra dos fluxos de sincronização, persistência, interface e testes. Não representa uma auditoria exaustiva de todos os arquivos nem uma auditoria de segurança.

**Avaliação geral atual: aproximadamente 8,5/10 em manutenção e legibilidade, ante 8/10 na revisão anterior e 7,5/10 na avaliação inicial.** A nota é um julgamento qualitativo, não uma métrica automática. O projeto tem boa separação entre aplicações e proteções contra regressões, mas algumas áreas exigem conhecer estado global, convenções implícitas e detalhes de infraestrutura para fazer mudanças com segurança.

Não há indicação, nesta análise, de necessidade de reescrever a arquitetura. As melhorias podem ser incrementais.

## Evolução após o último commit

| Ponto | Situação atual |
| --- | --- |
| D01 — Responsabilidades da tela | Corrigido; apresentação, estado, associações e ações possuem fronteiras próprias |
| D02 — Mensagem prematura de sucesso | Corrigido; recuperação de falha parcial tratada separadamente em D09 |
| D03 — Dependências globais | Composição externa corrigida; transições assíncronas protegidas em D10 |
| D04 — Compatibilidade dos bancos | Corrigido; contrato combina assinaturas dos dois drivers e detalhes de dialeto ficam na infraestrutura |
| D05 — `any` nos contratos | Corrigido; `any` explícito proibido e fronteira dinâmica isolada e testada |
| D06 — Transações | Callback recebe a transação ativa; testes selecionados passaram em SQLite nesta revisão |
| D07 — Cobertura | Novos testes locais; pisos globais inalterados e cobertura atual não medida |
| D08 — Comentários | Limpeza parcial; redundância e mistura de idiomas permanecem |
| D09 — Repetição de salvamento após falha | Corrigido no cenário testado; não equivale a atomicidade de todas as gravações |
| D10 — Troca de contexto durante sincronização | Corrigido; mudanças aguardam o ciclo ativo e são serializadas |
| D11 — Recarregamento de atributos durante salvamento | Corrigido; retenção do novo ID não dispara hidratação |
| D12 — Consistência dos demais formulários em gravações por etapas | Corrigido nos oito fluxos identificados; coordenação e retomada são compartilhadas |

## Alcance da amostragem e outros formulários

**Não foi demonstrado que apenas Scene tenha problemas, nem que todos os demais formulários estejam corretos.** Scene recebeu uma análise mais profunda; as correções e os testes desse fluxo não validam automaticamente os fluxos equivalentes de outras entidades.

Há achados fora de Scene: dependências e transições de contexto da sincronização, limites de compatibilidade entre bancos e consumo implícito de transações por handlers antigos. Esses pontos são distintos de possíveis falhas nos outros formulários.

Os oito formulários encontrados com gravação conjunta da entidade e dados secundários foram revisados em D12: Character, Location, WorldRule, Item, Note, Chapter, Choice e ItemJourney. Plot permite editar relações somente depois que a entidade já existe e, portanto, não executa essas etapas na mesma ação de criação. Tamanho continua sendo apenas um critério para selecionar amostras, não evidência de defeito.

Uma próxima ampliação da análise deve acompanhar, em cada fluxo selecionado:

- Criação e edição completas, incluindo relações e atributos.
- Falha em uma etapa secundária e nova tentativa, verificando identidade e ausência de duplicação.
- Preservação de valores ainda não gravados diante de recarregamento, navegação e mudança de contexto.
- Momento de emissão de eventos e mensagens de sucesso.
- Limites das transações e comportamento das operações parcialmente concluídas.

Essas verificações são trabalho pendente de investigação; não devem ser registradas como bugs confirmados de outras entidades.

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

A tela passou de 653 para 385 linhas físicas no commit inspecionado e agora se limita à composição dos hooks e à apresentação dos campos. O cálculo do índice fica em `SceneService`, enquanto `SceneSaveCoordinator` coordena a gravação base e as persistências secundárias.

Estado, hidratação e valores padrão ficam em `useSceneFormState`; criação do serviço e inicialização dos stores ficam em `useSceneFormResources`; relações, presença de personagens e efeitos ficam em `useSceneFormAssociations`. `useSceneFormActions` concentra validação, salvamento, exclusão, atributos, eventos, feedback e navegação.

Testes próprios do hook de ações verificam rejeição de entrada inválida, persistência completa e exclusão. O teste arquitetural impede que coordenação de persistência, alertas, eventos ou os hooks de associações retornem diretamente à tela.

Referências: [SceneFormScreen.tsx](apps/client/src/screens/narrative-elements/scenes/SceneFormScreen.tsx), [SceneService.ts](apps/client/src/services/storymanagement/SceneService.ts), [SceneSaveCoordinator.ts](apps/client/src/services/storymanagement/SceneSaveCoordinator.ts), [useSceneFormState.ts](apps/client/src/screens/narrative-elements/scenes/useSceneFormState.ts), [useSceneFormResources.ts](apps/client/src/screens/narrative-elements/scenes/useSceneFormResources.ts), [useSceneFormAssociations.ts](apps/client/src/screens/narrative-elements/scenes/useSceneFormAssociations.ts), [useSceneFormActions.ts](apps/client/src/screens/narrative-elements/scenes/useSceneFormActions.ts), [testes das ações](apps/client/test/screens/narrative-elements/scenes/useSceneFormActions.test.ts).

### D02 — Mensagem de sucesso antecede a conclusão da gravação

**Status: corrigido quanto ao momento da mensagem.**

A tela agora aguarda `saveSceneWithRelations` concluir a persistência de relações e atributos antes de comunicar sucesso. O apontamento anterior de mensagem prematura não descreve mais o código atual.

Isso não garante atomicidade das gravações. D09 registra a correção da repetição com o mesmo ID, e D11 impede que a retenção desse ID dispare uma hidratação concorrente.

Referências: [SceneFormScreen.tsx](apps/client/src/screens/narrative-elements/scenes/SceneFormScreen.tsx), [SceneSaveCoordinator.ts](apps/client/src/services/storymanagement/SceneSaveCoordinator.ts), [testes do coordenador](apps/client/test/services/SceneSaveCoordinator.test.ts).

### D03 — Dependências globais e estado mutável dificultam isolamento

**Status: corrigido.**

`SyncEngineService` não possui mais construtor privado, `getInstance` ou criação interna de dependências concretas. Seu construtor público recebe `SyncEngineDependencies`, que inclui notificações, publicação de eventos, autenticação, cliente HTTP, handlers, serviços de conflito/servidor e operações de transferência. Testes podem criar instâncias independentes e substituir essas dependências sem acessar estado global da classe.

A escolha das implementações concretas e da instância única usada pelo aplicativo foi movida para `appSyncEngine`, a raiz de composição. O contexto agora possui operações explícitas de `bindDatabase`, `activateStory`, `stopSync`, `deactivateStory` e `reset`, além do estado observável `unbound`, `idle`, `active` ou `running`. Parar o agendamento não apaga mais silenciosamente a história ativa; encerrar o contexto é uma operação separada.

Um teste de arquitetura impede que singleton, emissor global, gerenciador de autenticação ou adaptador concreto de notificações retornem ao serviço. Os chamadores e testes foram migrados para a nova composição e para o ciclo de vida explícito.

Referências: [SyncEngineService.ts](apps/client/src/services/SyncEngineService.ts), [appSyncEngine.ts](apps/client/src/services/sync/appSyncEngine.ts), [SyncInitializer.tsx](apps/client/src/components/features/app/SyncInitializer.tsx), [teste de arquitetura](apps/client/test/architecture/importBoundaries.test.ts).

### D04 — Contrato compatível entre bancos

**Status: corrigido.**

`CompatibleDb` deixou de ser definido pelas assinaturas de PostgreSQL. Cada operação comum (`select`, `selectDistinct`, `insert`, `update` e `delete`) agora combina as assinaturas nativas de PostgreSQL e libSQL; as consultas relacionais expõem somente `findFirst` e `findMany`, também compostos a partir dos dois drivers. Recursos específicos, como `$with`, `$count`, `all`, `run` e execução SQL bruta, não fazem parte do contrato consumido pelos serviços.

`execute` foi removido da superfície comum porque ele não existe no contrato do `LibSQLDatabase`; os bloqueios SQL exclusivos de PostgreSQL foram movidos para `db/sqlOperators.ts`. A configuração de transação específica dos drivers também deixou de vazar: `withWriteTransaction` expressa a intenção de escrita e escolhe internamente o modo `immediate` no SQLite, reutilizando uma transação ativa quando houver. O serviço de amizades não conhece mais essa configuração.

Os construtores continuam retornando os tipos nativos de PostgreSQL e libSQL. Uma única ponte interna converte a conexão ou transação escolhida para a superfície compatível; o acesso nativo de migrations permanece discriminado por dialeto. Testes arquiteturais impedem imports dos drivers e dos builders `pg-core`/`sqlite-core` fora da infraestrutura de banco.

Os testes de contrato cobrem valores opcionais, chaves estrangeiras, datas, booleanos, JSON, consultas relacionais, `selectDistinct`, inserção, atualização, seleção, exclusão e rollback de transações comuns e de escrita. As suítes completas passaram nesta revisão nos dois motores. A ponte dos builders em `schema/columns.ts` continua necessária porque o Drizzle não oferece um schema genérico comum aos dois dialetos; ela fica confinada à infraestrutura e não concede capacidades específicas aos serviços.

**Regra de manutenção:** uma nova capacidade só pode entrar no contrato junto com sua assinatura nos dois drivers e um teste executado nos dois bancos. Operações exclusivas continuam em adaptadores de dialeto.

Referências: [banco da API](apps/api/src/db/index.ts), [migrations](apps/api/src/db/migrate.ts), [construtores de colunas](apps/api/src/db/schema/columns.ts), [testes de contrato](apps/api/test/db/databaseContract.integration.test.ts), [teste arquitetural](apps/api/test/architecture/layering.test.ts).

### D05 — Uso de `any` em contratos centrais de sincronização

**Status: corrigido.**

Os contratos agora usam `SyncEntity`, `SyncStoredEntity`, tipos derivados dos schemas Zod e `unknown` nas fronteiras dinâmicas. O ESLint proíbe `any` explícito em `apps/api/src`, e um teste de arquitetura verifica a árvore sintática dos arquivos.

O registro de tabelas escolhido em runtime mantém uma coerção localizada, necessária para apagar diferenças entre dezenas de tipos concretos do Drizzle. Essa fronteira não usa `any`, não vaza para os contratos do protocolo e tem testes que verificam cobertura de todas as entidades sincronizadas, auditáveis e exportáveis. Ela é uma decisão de infraestrutura documentada, não uma permissão para coerções nos consumidores.

Referências: [BaseSyncEntityHandler.ts](apps/api/src/services/entity-sync-handlers/BaseSyncEntityHandler.ts), [registro de tabelas](apps/api/src/services/entity-solvers/ApiEntityTableRegistry.ts), [ESLint da API](apps/api/eslint.config.mjs), [testes de arquitetura](apps/api/test/architecture/layering.test.ts).

### D06 — Contexto transacional implícito exige conhecimento de convenções

**Status: contrato explícito e garantias preservadas.**

`withTransaction` agora entrega a transação ativa ao callback. Chamadas aninhadas recebem a mesma sessão, enquanto uma chamada explícita a `db.transaction` dentro do contexto continua representando um savepoint. O coordenador de push já usa o parâmetro explícito para suas consultas locais.

`Proxy` e `AsyncLocalStorage` permanecem como camada de compatibilidade para handlers existentes que importam `db`, mas já não são a única forma de consumir o contexto. Os testes verificam a identidade da transação aninhada, o rollback externo e o rollback isolado do savepoint. Foram executados em SQLite nesta revisão; a execução anterior em PostgreSQL consta no histórico, sem revalidação aqui.

Novos consumidores transacionais devem preferir o parâmetro entregue pelo callback. A migração dos handlers pode continuar incrementalmente quando houver benefício local, sem exigir uma alteração ampla e arriscada apenas para remover a camada de compatibilidade.

Referências: [banco da API](apps/api/src/db/index.ts), [teste de contexto transacional](apps/api/test/db/transactionContext.integration.test.ts).

### D07 — Exigência de cobertura desigual entre núcleo e cliente completo

**Status: melhora localizada; avaliação global inalterada. Prioridade: média.**

Os pisos do cliente completo continuam em 40,2% de linhas e 30% de branches; os do núcleo de sincronização continuam em 91,9% e 81,5%. São limites configurados, não cobertura medida nesta avaliação.

O commit adicionou testes de coordenação do salvamento, indexação, contrato de banco e transações. Isso melhora a proteção de comportamentos específicos. Os testes do coordenador agora verificam também uma nova tentativa após falha em relações ou atributos, sem repetir a criação. Isso não comprova rollback nem integração completa entre hidratação do formulário e salvamento.

**Próximo passo:** ampliar os testes integrados dos formulários migrados e medir cobertura antes de reavaliar o panorama global.

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

### D10 — Troca de contexto durante uma sincronização em andamento

**Status: corrigido.**

`SyncScheduler.stopAndWait` suspende novas solicitações, descarta ciclos enfileirados e só conclui depois que a operação ativa termina. `SyncEngineService` serializa as mudanças de contexto e usa essa barreira antes de ativar ou desativar uma história, trocar o banco ou executar um reset. Assim, história, servidor, cliente HTTP e banco permanecem estáveis durante cada ciclo.

As operações de contexto agora são assíncronas. `SyncInitializer` e os demais chamadores aguardam sua conclusão; o efeito também invalida uma configuração que terminou de consultar o servidor depois de sua limpeza. Um teste mantém uma sincronização pendente, solicita a troca de história e verifica que o ciclo inteiro observa a história anterior antes de o novo contexto entrar em vigor. O teste do agendador verifica que solicitações novas são recusadas durante a espera.

Referências: [SyncEngineService.ts](apps/client/src/services/SyncEngineService.ts), [SyncScheduler.ts](apps/client/src/services/sync/SyncScheduler.ts), [SyncInitializer.tsx](apps/client/src/components/features/app/SyncInitializer.tsx), [testes do motor](apps/client/test/services/SyncEngineService.test.ts), [testes do agendador](apps/client/test/services/SyncScheduler.test.ts).

### D11 — Recarregamento de atributos pode competir com o salvamento

**Status: corrigido.**

`useSceneFormState` agora distingue o ID recebido ao abrir o formulário do ID apenas retido depois da primeira criação. A hidratação consulta exclusivamente `initialSceneId`; `retainPersistedSceneId` preserva a identidade necessária para repetir o salvamento sem iniciar uma leitura concorrente de atributos ainda incompletos.

Os testes verificam os dois lados do contrato: uma cena aberta para edição continua hidratando entidade e atributos, enquanto uma cena recém-criada retém seu ID e conserva os valores editados sem consultar novamente o banco.

Referências: [useSceneFormActions.ts](apps/client/src/screens/narrative-elements/scenes/useSceneFormActions.ts), [useSceneFormState.ts](apps/client/src/screens/narrative-elements/scenes/useSceneFormState.ts), [SceneSaveCoordinator.ts](apps/client/src/services/storymanagement/SceneSaveCoordinator.ts), [testes do estado do formulário](apps/client/test/screens/narrative-elements/scenes/useSceneFormState.test.ts).

### D12 — Consistência dos demais formulários em gravações por etapas

**Status: corrigido nos fluxos identificados.**

Character, Location, WorldRule, Item, Note, Chapter, Choice e ItemJourney comunicavam sucesso antes de relações ou atributos terminarem. Note não retinha o ID criado, permitindo duplicação em uma nova tentativa; os demais retinham o ID, mas podiam hidratar campos e relações enquanto as etapas secundárias ainda estavam em andamento.

`saveEntityWithSecondaryData` agora oferece a mesma sequência para todos esses formulários e para Scene: cria ou atualiza a entidade, retém imediatamente seu ID, conclui os dados secundários e somente então devolve o controle para evento, mensagem de sucesso e navegação. Cada tela hidrata exclusivamente o ID recebido ao abrir. `useEntityRelations` preserva seleções feitas durante a criação quando o ID persistido aparece.

Filas de relações pendentes removem cada item logo após sua gravação. Se uma relação posterior falhar, a nova tentativa retoma apenas o restante, sem repetir as etapas já concluídas. Testes do coordenador verificam retenção e repetição sem nova criação; testes do hook verificam preservação de tags e retomada após falha parcial. Um teste arquitetural exige o coordenador e a preservação de rascunhos nos oito formulários.

Referências: [coordenador compartilhado](apps/client/src/services/storymanagement/EntityFormSaveCoordinator.ts), [relações de entidades](apps/client/src/hooks/useEntityRelations.ts), [teste do coordenador](apps/client/test/services/EntityFormSaveCoordinator.test.ts), [teste das relações](apps/client/test/hooks/useEntityRelations.test.ts), [teste arquitetural](apps/client/test/architecture/layering.test.ts).

## Ordem sugerida de melhorias

1. Ampliar testes de comportamento e medir cobertura — D07.
2. Limpar comentários redundantes e consolidar a convenção de idioma — D08.

As correções específicas em D01, D02, D03, D05, D09, D10, D11 e D12 foram reconhecidas. D06 permite consumo explícito da transação e mantém uma camada de compatibilidade. Isso não encerra a investigação dos demais fluxos do projeto.

## Validação realizada e limitações

### Execuções desta reavaliação

A revisão compara `530cf574` com `b26c5ca7` e examina os arquivos relacionados aos achados. Não é uma auditoria exaustiva de todos os arquivos alterados.

- **API: 3 arquivos e 16 testes de arquitetura passaram.**
- **Cliente: 6 suítes e 91 testes selecionados passaram**, cobrindo `SceneSaveCoordinator`, `useSceneFormActions`, `SyncEngineService`, `SyncEngineTransfer`, `ServerRealtimeService` e `SyncScheduler`.
- **SQLite temporário exclusivo: 2 arquivos e 7 testes de contrato de banco e transações passaram.**
- PostgreSQL, suíte completa e cobertura não foram executados nesta reavaliação.
- Após as correções de D10 e D11, passaram lint, typecheck e **7 suítes com 98 testes selecionados** do cliente, cobrindo motor, agendador, transferência, formulário e fronteiras arquiteturais.
- A suíte completa do cliente também passou após D10 e D11: **256 suítes e 2.395 testes**.
- Após D12, passaram lint, typecheck e **6 suítes com 53 testes selecionados**, cobrindo coordenação, retomada de relações, Scene e regras arquiteturais.
- Após a conclusão de D04, passaram typecheck e lint da API, **35 arquivos com 213 testes unitários**, **55 arquivos com 613 testes de integração em SQLite** e **54 arquivos com 611 testes em PostgreSQL**, além de 1 arquivo e 2 testes condicionais ignorados nesse motor.
- A suíte completa do cliente passou após D12: **257 suítes e 2.407 testes**.
- As correções de D10 e D11 foram realizadas no estado de trabalho posterior ao commit `530cf574`.

### Resultados históricos preservados

A versão anterior do documento registrava as execuções abaixo. São preservadas como histórico informado, não como verificações independentes realizadas nesta reavaliação:

- Após D03: lint, typecheck e suíte do cliente com 254 arquivos e 2.388 testes.
- Após D01: lint, typecheck, 19 testes focados e suíte do cliente com 255 arquivos e 2.391 testes.
- Após D04 e D06: typecheck, lint e 35 arquivos com 212 testes unitários da API.
- Integração em SQLite com 55 arquivos e 610 testes; PostgreSQL com 54 arquivos e 608 testes, mais 1 arquivo e 2 testes condicionais ignorados.

### Limites das conclusões

- A nota é qualitativa e não certifica ausência de bugs, desempenho, segurança ou correção de todos os fluxos.
- Os oito formulários de gravação em etapas receberam revisão estrutural e proteção compartilhada; Scene ainda possui a cobertura integrada mais profunda desse grupo.
- Arquivo grande ou gravação em etapas são critérios de investigação, não prova automática de problema.
- Correções locais e testes aprovados não demonstram ausência de riscos equivalentes nos demais fluxos ainda não amostrados.
- Números de linhas e observações refletem o commit inspecionado e podem mudar com a evolução do repositório.
