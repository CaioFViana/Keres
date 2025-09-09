## Análise das Rotas Atuais e Identificação de Ausências

As rotas atuais implementam o CRUD padrão para a maioria das entidades e já possuem várias rotas aninhadas para buscar entidades filhas por ID do pai (ex: `GET /chapters/story/:storyId`). No entanto, há lacunas significativas em relação às sugestões de otimização e funcionalidades avançadas.

### Rotas Atuais (Resumo por Categoria)

*   **CRUD Padrão:** Presente para quase todas as entidades (`POST /`, `GET /:id`, `PUT /:id`, `DELETE /:id`).
*   **Recursos Aninhados Existentes:**
    *   `GET /chapters/story/:storyId`
    *   `GET /characters/story/:storyId`
    *   `GET /choices/by-scene/:sceneId`
    *   `GET /gallery/owner/:ownerId`
    *   `GET /gallery/story/:storyId`
    *   `GET /locations/story/:storyId`
    *   `GET /moments/by-scene/:sceneId`
    *   `GET /notes/story/:storyId`
    *   `GET /scenes/chapter/:chapterId`
    *   `GET /stories/all` (equivalente a `/user/:userId` para o usuário logado)
    *   `GET /suggestions/user/:userId`
    *   `GET /suggestions/story/:storyId`
    *   `GET /suggestions/type/:type`
    *   `GET /suggestions/user/:userId/type/:type`
    *   `GET /suggestions/story/:storyId/type/:type`
    *   `GET /tags/story/:storyId`
    *   `GET /world-rules/story/:storyId`
    *   `GET /character-moments/character/:characterId`
    *   `GET /character-moments/moment/:momentId`
    *   `GET /character-relations/character/:charId`
*   **Operações Específicas:**
    *   `POST /users/register`
    *   `POST /users/login`
    *   `GET /users/profile/:id`
    *   `GET /gallery/images/:id` (para servir arquivos de imagem)
    *   `POST /tags/add` (adicionar tag a uma entidade)
    *   `DELETE /tags/remove` (remover tag de uma entidade)

### Rotas e Funcionalidades Faltando (Plano de Desenvolvimento)

Esta lista detalha as rotas e funcionalidades que não foram encontradas na implementação atual, categorizadas para um plano de desenvolvimento.

---

### Fase 1: Otimização da Recuperação de Dados (Alto Impacto para o Frontend)

1.  **Inclusão de Dados Relacionados (Query Parameters - `?include=...`)**
    *   **Descrição:** Modificar rotas `GET /:id` e `GET /parent/:parentId` para aceitar um parâmetro de consulta `include` (ex: `?include=relatedEntity1,relatedEntity2`). Isso permite que o frontend obtenha uma entidade e seus dados relacionados em uma única requisição, reduzindo chamadas à API e simplificando a lógica do cliente.
    *   **Entidades Alvo:** Todas as entidades que possuem relações diretas (ex: `Story` com `characters`, `chapters`; `Character` com `moments`, `relations`; `Scene` com `moments`, `choices`).
    *   **Exemplo de Rota a Implementar:** `GET /characters/:id?include=moments,relations`

2.  **Completar Rotas Aninhadas para Recursos Diretos (se ainda não estiverem no formato `/parent/:parentId/child`)**
    *   **Descrição:** Embora muitas rotas aninhadas existam, algumas entidades filhas ainda são acessadas via `GET /child/parent/:parentId` em vez de `GET /parent/:parentId/child`. Padronizar para o formato `/parent/:parentId/child` quando apropriado.
    *   **Rotas a Padronizar/Implementar:**
        *   `GET /stories/:storyId/locations` (atualmente `GET /locations/story/:storyId`)
        *   `GET /stories/:storyId/notes` (atualmente `GET /notes/story/:storyId`)
        *   `GET /stories/:storyId/tags` (atualmente `GET /tags/story/:storyId`)
        *   `GET /stories/:storyId/world-rules` (atualmente `GET /world-rules/story/:storyId`)
        *   `GET /stories/:storyId/gallery` (atualmente `GET /gallery/story/:storyId`)
        *   `GET /chapters/:chapterId/moments` (atualmente `GET /moments/by-scene/:sceneId` - esta exigiria uma lógica mais complexa para buscar momentos através das cenas de um capítulo, ou uma rota direta se o esquema permitir).

---

### Fase 2: Otimização da Manipulação de Dados

1.  **Atualizações Parciais (PATCH)**
    *   **Descrição:** Adicionar métodos `PATCH` para todas as entidades que possuem `PUT`. Isso permite que o cliente envie apenas os campos que deseja modificar, otimizando o tráfego e a lógica de atualização.
    *   **Entidades Alvo:** Todas as entidades com rotas `PUT`.
    *   **Exemplo de Rota a Implementar:** `PATCH /[entidade]/:id`

2.  **Criação/Atualização em Lote (Batch Operations)**
    *   **Descrição:** Implementar rotas para criar ou atualizar múltiplas entidades em uma única requisição.
    *   **Entidades Alvo:** `Moment`, `Character`, `Chapter`, `Scene` (entidades que podem ser criadas/atualizadas em massa).
    *   **Exemplos de Rotas a Implementar:**
        *   `POST /[entidade]/batch` (para criação)
        *   `PUT /[entidade]/batch` (para atualização)

3.  **Deleção em Lote (Bulk Delete)**
    *   **Descrição:** Implementar rotas para deletar múltiplas entidades em uma única requisição.
    *   **Entidades Alvo:** Todas as entidades.
    *   **Exemplos de Rotas a Implementar:**
        *   `POST /[entidade]/bulk-delete`

4.  **Operações Transacionais/Compostas Específicas**
    *   **Descrição:** Implementar rotas para operações de negócio que envolvem a criação ou modificação atômica de múltiplas entidades.
    *   **Rotas a Implementar:**
        *   `POST /scenes/with-choices`: Cria uma nova cena e suas escolhas iniciais em uma única transação.
        *   `POST /stories/import`: Rota dedicada para a funcionalidade de importação de histórias completas (conforme estratégia offline).

---

### Fase 3: Consultas Avançadas e Funcionalidades Específicas

1.  **Filtragem, Ordenação e Paginação Avançadas**
    *   **Descrição:** Aprimorar a `ListQuerySchema` e sua aplicação nas rotas `GET` de listagem para suportar filtragem mais complexa (ex: por múltiplos campos, ranges), ordenação explícita por qualquer campo e paginação robusta.
    *   **Entidades Alvo:** Todas as rotas `GET` de listagem (ex: `GET /characters/story/:storyId`, `GET /chapters/story/:storyId`).

2.  **Busca Global**
    *   **Descrição:** Criar um endpoint unificado para buscar palavras-chave em múltiplos campos e/ou tipos de entidades.
    *   **Rota a Implementar:** `GET /search?query=keyword&scope=entity1,entity2,...`

---

### Fase 4: Boas Práticas e Manutenção a Longo Prazo

1.  **Versionamento da API**
    *   **Descrição:** Implementar uma estratégia de versionamento (ex: `api/v1/`) para todas as rotas, permitindo a evolução da API sem quebrar clientes existentes.

2.  **Padronização de Erros**
    *   **Descrição:** Revisar e padronizar todas as respostas de erro da API para garantir consistência nos códigos de status HTTP, códigos de erro internos e mensagens.

3.  **Webhooks/Notificações em Tempo Real (Consideração Futura)**
    *   **Descrição:** Pesquisar e planejar a implementação de webhooks ou WebSockets para funcionalidades colaborativas ou atualizações em tempo real.

---

Este plano fornece um roteiro claro para aprimorar a API do Keres, tornando-a mais completa, eficiente e robusta para o desenvolvimento do frontend e para as necessidades futuras do projeto.
