# Avaliação da arquitetura, manutenção e legibilidade

Data: 6 de setembro de 2026.

## Escopo e resultado

Avaliação qualitativa da estrutura do monorepo e de uma amostra dos fluxos de sincronização, persistência, interface e testes. Não representa uma auditoria exaustiva de todos os arquivos nem uma auditoria de segurança.

**Avaliação geral: aproximadamente 7,5/10 em manutenção e legibilidade.** A nota é um julgamento qualitativo, não uma métrica automática. O projeto tem boa separação entre aplicações e proteções contra regressões, mas algumas áreas exigem conhecer estado global, convenções implícitas e detalhes de infraestrutura para fazer mudanças com segurança.

Não há indicação, nesta análise, de necessidade de reescrever a arquitetura. As melhorias podem ser incrementais.

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

**Status: resolvido.**

O cálculo do índice de uma nova cena passou para `SceneService`, enquanto a gravação da cena, relações e atributos é coordenada por `SceneSaveCoordinator`. Estado e hidratação do formulário ficam em `useSceneFormState`; criação do serviço e inicialização dos quatro stores ficam em `useSceneFormResources`.

`SceneFormScreen.tsx` agora se concentra na composição dos campos, validações de interação, feedback e navegação. Um teste de arquitetura impede que a tela volte a inicializar diretamente os stores ou o serviço de cenas, e os fluxos extraídos possuem testes próprios.

Referências: [SceneFormScreen.tsx](apps/client/src/screens/narrative-elements/scenes/SceneFormScreen.tsx), [SceneService.ts](apps/client/src/services/storymanagement/SceneService.ts), [SceneSaveCoordinator.ts](apps/client/src/services/storymanagement/SceneSaveCoordinator.ts), [useSceneFormState.ts](apps/client/src/screens/narrative-elements/scenes/useSceneFormState.ts), [useSceneFormResources.ts](apps/client/src/screens/narrative-elements/scenes/useSceneFormResources.ts) e [testes de arquitetura](apps/client/test/architecture/layering.test.ts).

### D02 — Mensagem de sucesso antecede a conclusão da gravação

**Prioridade: alta.**

No fluxo de salvar cena, `AppAlert.alert` comunica sucesso após criar ou atualizar a cena, antes de persistir tags, notas, relações, personagens e atributos personalizados. Uma falha posterior pode produzir feedback contraditório para o usuário.

O achado é a ordem das operações no código. Não foi reproduzida uma falha em execução nem demonstrado que todas as gravações associadas são atômicas.

**Melhoria sugerida:** comunicar sucesso somente depois de concluir a operação completa e definir explicitamente o comportamento diante de falhas parciais. Avaliar a transação apropriada para gravações que precisem ser indivisíveis.

Referência: [SceneFormScreen.tsx](apps/client/src/screens/narrative-elements/scenes/SceneFormScreen.tsx), linhas 349–389 no momento da inspeção.

### D03 — Dependências globais e estado mutável dificultam isolamento

**Prioridade: média.**

`SyncEngineService` é singleton e mantém banco, história e servidor ativos como estado mutável. Também acessa diretamente notificações, traduções e eventos. Para entender uma operação, é necessário saber quem configurou esse estado anteriormente.

O coordenador mistura sincronização com apresentação de mensagens, aumentando o acoplamento e a preparação necessária nos testes. A divisão interna entre push, pull, mídia e agendamento já é uma boa base para melhorar esse ponto.

**Melhoria sugerida:** injetar dependências de notificação e contexto; explicitar o ciclo de vida do coordenador; preferir resultados ou eventos de domínio que uma camada superior converta em mensagens.

Referências: [SyncEngineService.ts](apps/client/src/services/SyncEngineService.ts), [testes do coordenador](apps/client/test/services/SyncEngineService.test.ts).

### D04 — Compatibilidade entre bancos depende de coerções de tipos

**Prioridade: média, com atenção especial ao alterar persistência.**

A implementação SQLite é convertida para o tipo de banco PostgreSQL com `as unknown as Db`. Os construtores de colunas também são expostos com tipos PostgreSQL, mesmo quando a implementação selecionada é SQLite.

Essa decisão reduz duplicação e está documentada, mas o compilador não garante que todas as operações permitidas pelo tipo tenham o mesmo comportamento nos dois motores. Uma mudança pode compilar e falhar apenas em um deles. Os testes nos dois bancos mitigam esse risco, sem eliminar a fragilidade do contrato.

**Melhoria sugerida:** delimitar explicitamente a superfície de operações compatíveis, concentrar coerções no adaptador e manter testes de contrato nos dois bancos para cada nova operação relevante.

Referências: [banco da API](apps/api/src/db/index.ts), especialmente `createSqliteDb`, e [construtores de colunas](apps/api/src/db/schema/columns.ts).

### D05 — Uso de `any` em contratos centrais de sincronização

**Status: resolvido.**

Os contratos de sincronização agora usam registros persistidos derivados dos schemas Zod de cada handler e `unknown` nas fronteiras realmente dinâmicas. O registro de tabelas do Drizzle possui um adaptador estrutural próprio, sem propagar tipos abertos para os serviços.

`@typescript-eslint/no-explicit-any` está ativo para todo `apps/api/src`, sem exceções. Um teste de arquitetura percorre a árvore sintática de todos os arquivos da aplicação e falha diante de qualquer `any` explícito, evitando tanto regressões quanto falsos positivos em comentários e textos.

Referências: [BaseSyncEntityHandler.ts](apps/api/src/services/entity-sync-handlers/BaseSyncEntityHandler.ts), [registro de tabelas](apps/api/src/services/entity-solvers/ApiEntityTableRegistry.ts), [ESLint da API](apps/api/eslint.config.mjs) e [testes de arquitetura](apps/api/test/architecture/layering.test.ts).

### D06 — Contexto transacional implícito exige conhecimento de convenções

**Prioridade: média.**

Um `Proxy` com `AsyncLocalStorage` faz o objeto `db` resolver para a conexão normal ou para a transação ativa. A solução é centralizada e documentada, mas uma chamada isolada não revela qual contexto será usado.

O próprio código informa que `withTransaction` abre uma nova transação e não reconhece aninhamento, enquanto `db.transaction` dentro do contexto segue outro comportamento. Essa distinção aumenta o cuidado necessário ao compor serviços.

**Melhoria sugerida:** tornar o contrato de aninhamento explícito e testado; considerar contexto transacional passado explicitamente nas operações mais críticas ou uma API que impeça usos ambíguos.

Referência: [banco da API](apps/api/src/db/index.ts), especialmente `withTransaction` e o `Proxy` exportado como `db`.

### D07 — Exigência de cobertura desigual entre núcleo e cliente completo

**Prioridade: média.**

Os pisos configurados para o cliente completo são 40,2% de linhas e 30% de branches. Para o núcleo de sincronização do cliente são 91,9% e 81,5%, respectivamente.

A priorização do núcleo é positiva, mas o piso global ainda admite bastante código sem cobertura. Isso dá menos proteção a mudanças na interface e em sua coordenação de estado e persistência.

**Esses valores são limites configurados, não cobertura medida nesta avaliação.**

**Melhoria sugerida:** ampliar testes de comportamentos relevantes dos fluxos de edição e salvamento, incluindo falhas, antes de perseguir uma porcentagem global arbitrária.

Referências: [pisos de cobertura](scripts/coverage-thresholds.json), [configuração Jest do cliente](apps/client/jest.config.js).

### D08 — Comentários redundantes e idioma inconsistente

**Prioridade: baixa.**

Embora vários comentários expliquem decisões úteis, outros repetem o código, como `Import useChapterStore` e `State for selected chapter`. Há também mistura de português e inglês nos comentários. Isso adiciona ruído e reduz a uniformidade da leitura.

**Melhoria sugerida:** remover comentários que apenas narram a instrução e adotar uma convenção de idioma para novos comentários. Preservar explicações de decisões, invariantes e limitações.

Referência: [SceneFormScreen.tsx](apps/client/src/screens/narrative-elements/scenes/SceneFormScreen.tsx).

## Ordem sugerida de melhorias

1. Corrigir o momento da mensagem de sucesso e extrair a coordenação de salvar cena e relações — D01 e D02.
2. Reduzir `any` nos contratos centrais de sincronização — D05.
3. Injetar dependências de notificações e contexto no coordenador de sincronização — D03.
4. Explicitar e testar os contratos de compatibilidade entre bancos e de transações — D04 e D06.
5. Ampliar testes de comportamento dos fluxos do cliente alterados — D07.
6. Limpar comentários redundantes durante a manutenção dos arquivos — D08.

## Validação realizada e limitações

- Foram examinados a estrutura, configurações, pipeline e arquivos representativos; não todos os fluxos do produto.
- Foram executados os testes de arquitetura da API: **3 arquivos e 9 testes passaram**.
- A suíte completa, a cobertura e os testes de integração não foram executados nesta avaliação.
- A nota não certifica ausência de bugs nem desempenho, segurança ou correção de todos os fluxos.
- Nenhum código de aplicação foi alterado durante a análise.
- Números de linhas e observações refletem o estado inspecionado em 6 de setembro de 2026 e podem mudar com a evolução do repositório.
