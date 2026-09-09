# Avaliação da arquitetura, manutenção e legibilidade

Análise inicial: 6 de setembro de 2026.

Reavaliações anteriores: 7 de setembro de 2026 (commits `d21ff776` e correção `90e92735`); 9 de setembro de 2026 (auditoria ampla).

**Atualização desta versão: 9 de setembro de 2026** — resolução das pendências P01–P10 sobre o commit de trabalho atual (base `90e92735` + alterações desta sessão).

## Escopo e resultado

Avaliação qualitativa da estrutura do monorepo e dos fluxos de sincronização, persistência, interface, pacote compartilhado, ferramentas e testes. Não representa uma auditoria de segurança.

### Veredito

**A arquitetura do Keres é boa e madura: aproximadamente 8,9/10 em manutenção e legibilidade** (antes 8,6/10 na auditoria ampla do mesmo dia e 8,7/10 na consolidação pós-D13).

A alta deve-se ao fechamento das pendências estruturais abertas: contrato de banco reforçado, sync desacoplado do store, formulários Character/Location no padrão Scene, erros HTTP uniformizados, shared alinhado, política de gravação parcial documentada e testada, e pisos de cobertura atualizados com medição.

Não há indicação de necessidade de reescrever a arquitetura.

### Notas por dimensão

| Dimensão | Nota | Comentário |
| --- | --- | --- |
| Separação do monorepo | 9,5 | Papéis claros; desktop fino; site independente |
| Contratos compartilhados | 9,0 | Barrel, docs e cobertura de solvers/theme alinhados |
| Sincronização | 9,2 | DI + notifier único; operation log aceita `tx` explícito |
| Persistência dual | 8,5 | Contrato documentado, chaves proibidas checadas, testes SQLite verdes |
| Camadas do cliente | 8,8 | Scene, Character e Location no mesmo padrão de orquestração |
| Camadas da API | 9,2 | Rotas sem `throw new Error`; `AppError` na borda HTTP |
| Testes de arquitetura | 9,5 | Fronteiras executáveis e allowlists que só encolhem |
| Cobertura | 8,5 | Medição em 9/9; pisos ratcheted; shared inclui solvers/theme |
| Consistência de erros/composição | 9,0 | Notifier e AppError nas fronteiras críticas |

## Pendências

**Todas as pendências P01–P10 desta avaliação foram resolvidas nesta sessão.** Trabalho residual natural (outros formulários além de Character/Location no padrão Scene, rotas que usam `set.status` + return sem throw, medição Postgres nesta máquina) não reabre os itens fechados abaixo.

| ID | Status | O que foi feito |
| --- | --- | --- |
| P01 | Concluído | Contrato documentado; chaves proibidas ampliadas (`execute`, etc.); superfície obrigatória checada; testes de contrato SQLite passaram |
| P02 | Concluído | Política coberta por fluxo; testes de Character/Location actions com falha parcial; `useEntityRelations` mantido |
| P03 | Concluído | Política de gravação parcial documentada no coordenador e verificada por testes |
| P04 | Concluído | Shared mede solvers/theme; `coverage:update` ratchetou pisos com medição de 9/9 |
| P05 | Concluído | Comentários redundantes removidos nos formulários Character/Location tocados |
| P06 | Concluído | `SyncOperationLogService.append` / push / recovery usam `CompatibleDb` explícito |
| P07 | Concluído | Character e Location extraídos no padrão Scene; testes de arquitetura e de hooks |
| P08 | Concluído | `SyncPush` e `StoryTransfer` usam `SyncNotifier`; store só no adaptador |
| P09 | Concluído | Rotas migradas para `AppError`; guard arquitetural impede `throw new Error` em routes |
| P10 | Concluído | `Item` no barrel; docs; cobertura; correção de claims sobre `apps/site` |

## Evolução dos achados

| Ponto | Situação atual |
| --- | --- |
| D01–D03, D05, D09–D11, D13 | Corrigidos (avaliações anteriores) |
| D04 | Limitação tipada residual mitigada: documentação + checks de chaves proibidas/obrigatórias + contrato SQLite |
| D06 | Consumidores críticos de sync/recovery preferem `tx` explícito |
| D07 | Medição atual registrada; pisos elevados onde a margem permitiu |
| D08 | Limpeza nos arquivos tocados nesta sessão |
| D12 | Contrato + Character/Location estruturalmente alinhados; demais formulários multi-etapa mantêm o coordenador |
| D14 | Resolvido para Character e Location |
| D15 | Resolvido |
| D16 | Resolvido para throws HTTP nas rotas |
| D17 | Resolvido |

## Arquitetura geral

| Área | Responsabilidade |
| --- | --- |
| `apps/client` | React Native/Expo, SQLite local, sync offline-first |
| `apps/api` | Bun/Elysia, PostgreSQL ou SQLite, sync, colaboração, mídia |
| `apps/desktop` | Electron fino sobre o build web do cliente |
| `apps/admin` | Administração + showcase |
| `apps/site` | Landing pública (sem `@keres/shared`) |
| `packages/shared` | Entidades, Zod, regras, solvers, grafos, tema, metadados |

## Boas práticas (resumo)

- Monorepo com fronteiras claras e testes de arquitetura executáveis
- Sync decomposto com DI e notifier na composição
- Kernel `@keres/shared` portável
- Salvamento multi-etapa padronizado (`saveEntityWithSecondaryData`) com política de recuperação documentada
- Dual-DB com adaptadores e contrato testado
- CI com lockfile congelado e pisos de cobertura com ratchet

## Dívidas residuais conscientes (não reabrem P01–P10)

1. **Outros formulários multi-etapa** (WorldRule, Item, Note, Chapter, Choice, ItemJourney) ainda podem extrair orquestração no padrão Scene quando forem tocados — o contrato de persistência já é compartilhado.
2. **Algumas rotas** ainda usam `set.status` + `return { message }` (sem throw); o guard cobre `throw new Error`, não esse padrão de early-return.
3. **Interseção tipada Drizzle** continua sendo ergonomia, não prova completa de portabilidade; a prova operacional são os testes de contrato nos dois motores (SQLite revalidado aqui; PostgreSQL histórico).
4. **ALS** permanece como compatibilidade para handlers legados.

## Validação desta sessão

### Testes executados

- Cliente: SyncPush, importBoundaries, EntityFormSaveCoordinator, multiStepFormPartialSave.policy, useEntityRelations, Character/Location form actions, SyncEngineTransfer, layering — **aprovados**
- API: layering (incl. AppError + contrato DB), errors, transactionContext SQLite, databaseContract SQLite — **aprovados**
- Shared: boundaries + `test:coverage` (670 testes) — **aprovados**; medição ~96,2% linhas / 96,0% funções / 80,2% branches com solvers/theme incluídos
- `bun run coverage:update` — ratchet aplicado (ex.: cliente 40,8% linhas; sync core functions 93,8%)

### Limites

- Suíte completa do cliente/API e integração PostgreSQL não foram reexecutadas por completo nesta sessão.
- A nota permanece qualitativa e não certifica ausência de bugs em todo o produto.
